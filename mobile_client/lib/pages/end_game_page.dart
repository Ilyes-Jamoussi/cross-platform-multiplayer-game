import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/app/router.dart';
import 'package:mobile_client/models/account_type.dart';
import 'package:mobile_client/models/game_models.dart';
import 'package:mobile_client/models/lobby_models.dart';
import 'package:mobile_client/services/active_game_service.dart';
import 'package:mobile_client/services/auth_service.dart';
import 'package:mobile_client/services/game_team_chat_service.dart';
import 'package:mobile_client/services/lobby_room_service.dart';
import 'package:mobile_client/services/room_chat_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/widget/coin_icon.dart';
import 'package:mobile_client/widget/game_chat_journal_panel.dart';
import 'package:mobile_client/widget/profile_background.dart';
import 'package:mobile_client/widget/web_game_flow_floating_actions.dart';
import 'package:mobile_client/widget/web_game_flow_header.dart';
import 'package:mobile_client/widget/poly_arena_message_popup.dart';
import 'package:provider/provider.dart';

/// Aligned with the Angular `end-page.component` + `end-page.component.scss`
/// (titre, grille 2fr/1fr, panneaux 80vmin, top-cards, chat `app-game-chat`).
class EndGamePage extends StatefulWidget {
  const EndGamePage({super.key});

  @override
  State<EndGamePage> createState() => _EndGamePageState();
}

const Color _kRowBg = Color(0xFF0A0B10);
const Color _kRowBgAlt = Color(0xFF111218);
const Color _kCellText = Color(0xFFCCD0D9);
const Color _kMutedLabel = Color(0xFFAAB0BC);

/// Coin color like `end-page.component.scss` (`.balance-value` / `.new-balance-value`).
const Color _kCoinGold = Color(0xFFE6B830);

const List<String> _kSortColumns = <String>[
  'name',
  'nCombats',
  'nEvasions',
  'nVictories',
  'nDefeats',
  'hpLost',
  'hpDealt',
  'nItemsCollected',
  'tilesVisitedPercentage',
];

class _EndGamePageState extends State<EndGamePage> {
  late GameStatsPayload _stats;
  late List<EndGamePlayer> _players;
  String? _sortColumn;
  bool _ascending = true;
  bool _loadedStats = false;
  final TextEditingController _chatInput = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final lobby = context.read<LobbyRoomService>();
      final roomId = lobby.roomId;
      if (roomId != null) {
        context.read<RoomChatService>().attach(roomId);
      }
      // Same as Angular: only `app-game-chat` (room), not the team channel.
      context.read<GameTeamChatService>().detach();
      context.read<AuthService>().refreshProfile();
    });
  }

  @override
  void dispose() {
    _chatInput.dispose();
    super.dispose();
  }

  /// Same sender as the game page: `currentPlayer`, otherwise roster (e.g. end of game).
  LobbyPlayer? _chatSender(LobbyRoomService lobby, ActiveGameService game) {
    final fromLobby = lobby.currentPlayer;
    if (fromLobby != null) return fromLobby;
    final id = game.myPlayerId;
    if (id.isEmpty) return null;
    for (final rp in game.rosterPlayers) {
      if (rp.id == id) {
        return LobbyPlayer(
          id: rp.id,
          name: rp.name,
          avatar: rp.avatar,
          isHost: rp.isHost,
          type: rp.type,
        );
      }
    }
    return null;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_loadedStats) return;
    _loadedStats = true;
    final game = context.read<ActiveGameService>();
    _stats =
        game.endGameStats ??
        GameStatsPayload(players: [], globalStats: GlobalStats());
    _players = List<EndGamePlayer>.from(_stats.players);
  }

  bool get _isCtf => _stats.gameMode?.toUpperCase() == 'CTF';

  GameReward? get _myReward {
    final name = context.read<AuthService>().currentUser?.username;
    if (name == null || name.isEmpty) return null;
    for (final r in _stats.rewards) {
      if (r.username == name) return r;
    }
    return null;
  }

  int get _myRewardAmount => _myReward?.amount ?? 0;

  void _sortBy(String column) {
    setState(() {
      if (_sortColumn == column) {
        _ascending = !_ascending;
      } else {
        _sortColumn = column;
        _ascending = true;
      }
      _players.sort((a, b) {
        if (column == 'name') {
          final na = a.name.toLowerCase();
          final nb = b.name.toLowerCase();
          final c = na.compareTo(nb);
          return _ascending ? c : -c;
        }
        final va = _statValue(a, column);
        final vb = _statValue(b, column);
        // Angular: isAscending true → valueB - valueA (numeric descending order).
        return _ascending ? vb.compareTo(va) : va.compareTo(vb);
      });
    });
  }

  double _statValue(EndGamePlayer p, String col) {
    final s = p.playerStats;
    if (s == null) return 0;
    switch (col) {
      case 'nCombats':
        return s.nCombats.toDouble();
      case 'nEvasions':
        return s.nEvasions.toDouble();
      case 'nVictories':
        return s.nVictories.toDouble();
      case 'nDefeats':
        return s.nDefeats.toDouble();
      case 'hpLost':
        return s.hpLost.toDouble();
      case 'hpDealt':
        return s.hpDealt.toDouble();
      case 'nItemsCollected':
        return s.nItemsCollected.toDouble();
      case 'tilesVisitedPercentage':
        return s.tilesVisitedPercentage;
      default:
        return 0;
    }
  }

  String _arrow(String col) {
    if (_sortColumn != col) return '';
    return _ascending ? '▲' : '▼';
  }

  void _goHome() {
    final lobby = context.read<LobbyRoomService>();
    final chat = context.read<RoomChatService>();
    final teamChat = context.read<GameTeamChatService>();
    final game = context.read<ActiveGameService>();
    final rootNav = Navigator.of(context, rootNavigator: true);
    lobby.leaveGameSocket();
    game.reset();
    lobby.resetAfterLeave();
    chat.detach();
    teamChat.detach();
    if (mounted) {
      final coinDelta = _myRewardAmount > 0 ? _myRewardAmount : null;
      rootNav.pushNamedAndRemoveUntil(
        AppRoutes.home,
        (r) => false,
        arguments: coinDelta,
      );
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!rootNav.mounted) return;
        showPolyArenaMessageDialog(
          context: rootNav.context,
          kind: PolyArenaMessageKind.warning,
          title: 'popup.left_game_title',
          message: 'popup.left_game_message',
          okLabel: 'common.ok',
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final theme = context.watch<ThemeService>();
    final auth = context.watch<AuthService>();
    final gs = _stats.globalStats;
    final chat = context.watch<RoomChatService>();
    final game = context.watch<ActiveGameService>();
    final myId = game.myPlayerId;
    final topPad = MediaQuery.paddingOf(context).top;

    Widget endPageChat() {
      return GameChatJournalPanel(
        roomChat: chat,
        teamChat: context.read<GameTeamChatService>(),
        isTeamGame: false,
        localPlayerId: myId,
        journal: game.filteredJournal,
        journalFilterMineOnly: game.journalFilterMineOnly,
        onToggleJournalFilter: game.toggleJournalFilter,
        chatInputController: _chatInput,
        onSubmitMessage: (teamChannel) {
          final lobby = context.read<LobbyRoomService>();
          final g = context.read<ActiveGameService>();
          final p = _chatSender(lobby, g);
          if (p == null) return;
          final text = _chatInput.text.trim();
          if (text.isEmpty) return;
          if (teamChannel) {
            context.read<GameTeamChatService>().send(text, p);
          } else {
            chat.send(text, p);
          }
          _chatInput.clear();
        },
        showJournalTab: false,
        endPageChatChrome: true,
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _goHome();
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        resizeToAvoidBottomInset: false,
        body: Stack(
          fit: StackFit.expand,
          children: [
            const Positioned.fill(child: ProfileBackground()),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                WebGameFlowHeader(onMenuPressed: _goHome),
                Expanded(
                  child: SafeArea(
                    top: false,
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final mq = MediaQuery.sizeOf(context);
                        final vmin = math.min(mq.width, mq.height) * 0.01;
                        final panelH = math.min(mq.width, mq.height) * 0.80;
                        final gap = 1.5 * vmin;

                        Widget topCardsRow() => IntrinsicHeight(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(
                                child: _BalanceSummary(
                                  theme: theme,
                                  i18n: i18n,
                                  profile: auth.currentUser,
                                  rewardAmount: _myRewardAmount,
                                ),
                              ),
                              SizedBox(width: gap),
                              Expanded(
                                child: _GlobalStatsPanel(
                                  theme: theme,
                                  i18n: i18n,
                                  gs: gs,
                                  showFlagHolders: _isCtf,
                                ),
                              ),
                            ],
                          ),
                        );

                        return Padding(
                          padding: EdgeInsets.fromLTRB(
                            2 * vmin,
                            vmin,
                            2 * vmin,
                            vmin,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Padding(
                                padding: EdgeInsets.fromLTRB(
                                  0.5 * vmin,
                                  0.5 * vmin,
                                  0.5 * vmin,
                                  vmin,
                                ),
                                child: Text(
                                  i18n.translate('end_page.title'),
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.pressStart2p(
                                    fontSize: (2.5 * vmin).clamp(9.0, 14.0),
                                    color: Colors.white,
                                    height: 1.35,
                                  ),
                                ),
                              ),
                              Expanded(
                                child: Align(
                                  alignment: Alignment.center,
                                  child: SizedBox(
                                    height: math.min(
                                      panelH,
                                      constraints.maxHeight - 4 * vmin,
                                    ),
                                    width: double.infinity,
                                    child: Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        Expanded(
                                          flex: 2,
                                          child: Padding(
                                            padding: EdgeInsets.all(1.5 * vmin),
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.stretch,
                                              children: [
                                                topCardsRow(),
                                                SizedBox(height: gap),
                                                Expanded(
                                                  child: LayoutBuilder(
                                                    builder: (context, lc) {
                                                      return _EndStatsTable(
                                                        parentWidth:
                                                            lc.maxWidth,
                                                        players: _players,
                                                        myPlayerId: myId,
                                                        theme: theme,
                                                        i18n: i18n,
                                                        onSort: _sortBy,
                                                        arrowFor: _arrow,
                                                      );
                                                    },
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                        Expanded(
                                          flex: 1,
                                          child: Padding(
                                            padding: EdgeInsets.all(1.5 * vmin),
                                            child: endPageChat(),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ],
            ),
            Positioned(
              top: topPad + 12,
              right: 20,
              child: const WebGameFlowFloatingActions(),
            ),
          ],
        ),
      ),
    );
  }
}

/// Table + scrolling like the web client: explicit intrinsic width
/// (avoids the 0×0 layout of `Table` + `FlexColumnWidth` in nested scrolls).
class _EndStatsTable extends StatelessWidget {
  const _EndStatsTable({
    required this.parentWidth,
    required this.players,
    required this.myPlayerId,
    required this.theme,
    required this.i18n,
    required this.onSort,
    required this.arrowFor,
  });

  static const double _colName = 116;
  static const double _colData = 54;
  static double get _tableIntrinsicWidth => _colName + 8 * _colData;

  final double parentWidth;
  final List<EndGamePlayer> players;
  final String myPlayerId;
  final ThemeService theme;
  final I18n i18n;
  final void Function(String column) onSort;
  final String Function(String col) arrowFor;

  @override
  Widget build(BuildContext context) {
    final contentW = math.max(parentWidth, _tableIntrinsicWidth);
    final colWidths = <int, TableColumnWidth>{
      for (var i = 0; i < 9; i++)
        i: FixedColumnWidth(i == 0 ? _colName : _colData),
    };

    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final outerRadius = math.max(6.0, vmin);
    final outerBorderW = math.max(1.0, vmin * 0.2);

    return ClipRRect(
      borderRadius: BorderRadius.circular(outerRadius),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: theme.primaryColor, width: outerBorderW),
          borderRadius: BorderRadius.circular(outerRadius),
        ),
        child: Scrollbar(
          thumbVisibility: true,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SingleChildScrollView(
              scrollDirection: Axis.vertical,
              child: SizedBox(
                width: contentW,
                child: Table(
                  columnWidths: colWidths,
                  border: TableBorder(
                    horizontalInside: BorderSide(
                      color: Colors.white.withValues(alpha: 0.04),
                      width: 1,
                    ),
                    verticalInside: BorderSide(
                      color: Colors.white.withValues(alpha: 0.04),
                      width: 1,
                    ),
                  ),
                  children: [
                    TableRow(
                      decoration: BoxDecoration(color: theme.primaryColor),
                      children: _kSortColumns
                          .asMap()
                          .entries
                          .map(
                            (e) => _TableHeaderCell(
                              label: i18n.translate(
                                'end_page.table.${e.value}',
                              ),
                              arrow: arrowFor(e.value),
                              theme: theme,
                              onTap: () => onSort(e.value),
                              showRightDivider:
                                  e.key < _kSortColumns.length - 1,
                            ),
                          )
                          .toList(),
                    ),
                    for (var i = 0; i < players.length; i++)
                      _playerRow(players[i], i, myPlayerId, theme, i18n),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  TableRow _playerRow(
    EndGamePlayer p,
    int index,
    String myId,
    ThemeService theme,
    I18n i18n,
  ) {
    final s = p.playerStats;
    final isMe = p.id == myId;
    final baseBg = index.isEven ? _kRowBg : _kRowBgAlt;
    final rowBg = isMe
        ? Color.alphaBlend(theme.highlightBgColor, baseBg)
        : baseBg;

    TextStyle cellStyle({bool bold = false}) => GoogleFonts.pressStart2p(
      fontSize: 7,
      color: isMe ? Colors.white : _kCellText,
      height: 1.4,
      fontWeight: bold ? FontWeight.w700 : FontWeight.normal,
    );

    final nameText = p.name.isEmpty
        ? i18n.translate('end_page.unknown')
        : p.name;
    final nameStyle = GoogleFonts.pressStart2p(
      fontSize: 7.5,
      color: isMe ? theme.tertiaryColor : Colors.white,
      fontWeight: FontWeight.w700,
      height: 1.4,
    );

    return TableRow(
      decoration: BoxDecoration(color: rowBg),
      children: [
        TableCell(
          verticalAlignment: TableCellVerticalAlignment.middle,
          child: Padding(
            padding: EdgeInsets.fromLTRB(isMe ? 6 : 8, 8, 6, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Row(
                children: [
                  if (isMe)
                    Padding(
                      padding: const EdgeInsets.only(right: 4),
                      child: Text(
                        '▶',
                        style: GoogleFonts.pressStart2p(
                          fontSize: 5.5,
                          color: theme.tertiaryColor,
                          height: 1.2,
                        ),
                      ),
                    ),
                  Expanded(
                    child: Text(
                      nameText,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: nameStyle,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        _numCell('${s?.nCombats ?? 0}', cellStyle()),
        _numCell('${s?.nEvasions ?? 0}', cellStyle()),
        _numCell('${s?.nVictories ?? 0}', cellStyle()),
        _numCell('${s?.nDefeats ?? 0}', cellStyle()),
        _numCell('${s?.hpLost ?? 0}', cellStyle()),
        _numCell('${s?.hpDealt ?? 0}', cellStyle()),
        _numCell('${s?.nItemsCollected ?? 0}', cellStyle()),
        _numCell(
          '${(s?.tilesVisitedPercentage ?? 0).toStringAsFixed(0)}%',
          cellStyle(),
        ),
      ],
    );
  }

  Widget _numCell(String text, TextStyle style) {
    return TableCell(
      verticalAlignment: TableCellVerticalAlignment.middle,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        child: Text(text, textAlign: TextAlign.center, style: style),
      ),
    );
  }
}

class _TableHeaderCell extends StatelessWidget {
  const _TableHeaderCell({
    required this.label,
    required this.arrow,
    required this.theme,
    required this.onTap,
    required this.showRightDivider,
  });

  final String label;
  final String arrow;
  final ThemeService theme;
  final VoidCallback onTap;
  final bool showRightDivider;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: theme.primaryColor,
      child: InkWell(
        onTap: onTap,
        hoverColor: theme.secondaryHoverColor,
        splashColor: theme.secondaryHoverColor.withValues(alpha: 0.4),
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: showRightDivider
                ? Border(
                    right: BorderSide(
                      color: Colors.white.withValues(alpha: 0.15),
                      width: 1,
                    ),
                  )
                : null,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.pressStart2p(
                    fontSize: 6,
                    color: Colors.white,
                    height: 1.35,
                  ),
                ),
                if (arrow.isNotEmpty)
                  Text(
                    arrow,
                    style: GoogleFonts.pressStart2p(
                      fontSize: 7,
                      color: Colors.white,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BalanceSummary extends StatelessWidget {
  const _BalanceSummary({
    required this.theme,
    required this.i18n,
    required this.profile,
    required this.rewardAmount,
  });

  final ThemeService theme;
  final I18n i18n;
  final AccountType? profile;
  final int rewardAmount;

  @override
  Widget build(BuildContext context) {
    final current = profile?.virtualCurrency ?? 0;
    final previous = current - rewardAmount;

    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF111218), Color(0xFF0A0B10)],
          ),
          border: Border.all(color: theme.primaryColor, width: 2),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
              color: theme.primaryColor,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CoinIcon(color: theme.onPrimaryButtonText, size: 18),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      i18n.translate('end_page.balance.title'),
                      textAlign: TextAlign.center,
                      style: GoogleFonts.pressStart2p(
                        fontSize: 8,
                        color: theme.onPrimaryButtonText,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            _balanceRow(
              i18n.translate('end_page.balance.previous'),
              '$previous',
              labelMuted: true,
            ),
            if (rewardAmount > 0)
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      i18n.translate('end_page.balance.reward'),
                      style: GoogleFonts.pressStart2p(
                        fontSize: 6.5,
                        color: theme.tertiaryColor,
                        height: 1.35,
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '+$rewardAmount ',
                          style: GoogleFonts.pressStart2p(
                            fontSize: 8,
                            color: _kCoinGold,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const CoinIcon(color: _kCoinGold, size: 14),
                      ],
                    ),
                  ],
                ),
              ),
            Container(
              height: 2,
              margin: const EdgeInsets.symmetric(horizontal: 10),
              color: theme.primaryColor,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    i18n.translate('end_page.balance.new'),
                    style: GoogleFonts.pressStart2p(
                      fontSize: 7,
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$current ',
                        style: GoogleFonts.pressStart2p(
                          fontSize: 9,
                          color: _kCoinGold,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const CoinIcon(color: _kCoinGold, size: 16),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _balanceRow(String label, String value, {bool labelMuted = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.pressStart2p(
                fontSize: 6.5,
                color: labelMuted ? _kMutedLabel : Colors.white,
                height: 1.35,
              ),
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                value,
                style: GoogleFonts.pressStart2p(
                  fontSize: 8,
                  color: _kCoinGold,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 4),
              const CoinIcon(color: _kCoinGold, size: 14),
            ],
          ),
        ],
      ),
    );
  }
}

class _GlobalStatsPanel extends StatelessWidget {
  const _GlobalStatsPanel({
    required this.theme,
    required this.i18n,
    required this.gs,
    required this.showFlagHolders,
  });

  final ThemeService theme;
  final I18n i18n;
  final GlobalStats gs;
  final bool showFlagHolders;

  @override
  Widget build(BuildContext context) {
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final radius = math.max(6.0, vmin);
    final borderW = math.max(1.5, vmin * 0.25);
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF111218), Color(0xFF0A0B10)],
          ),
          border: Border.all(color: theme.primaryColor, width: borderW),
          borderRadius: BorderRadius.circular(radius),
        ),
        child: Stack(
          fit: StackFit.passthrough,
          children: [
            Positioned.fill(
              child: ColoredBox(color: Colors.black.withValues(alpha: 0.7)),
            ),
            Column(
              children: [
                _gRow(
                  i18n.translate('end_page.global_stats.duration'),
                  gs.formattedDuration,
                ),
                _gRow(
                  i18n.translate('end_page.global_stats.total_turns'),
                  '${gs.totalTurns}',
                ),
                _gRow(
                  i18n.translate('end_page.global_stats.tiles_visited'),
                  '${gs.tilesVisitedPercentage}%',
                ),
                _gRow(
                  i18n.translate('end_page.global_stats.doors_used'),
                  '${gs.doorsUsedPercent.toStringAsFixed(2)}%',
                  isLast: !showFlagHolders,
                ),
                if (showFlagHolders)
                  _gRow(
                    i18n.translate('end_page.global_stats.flag_holders'),
                    '${gs.flagHolders.length}',
                    isLast: true,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _gRow(String label, String value, {bool isLast = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : Border(
                bottom: BorderSide(color: Colors.white.withValues(alpha: 0.06)),
              ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Text(
              label,
              style: GoogleFonts.pressStart2p(
                fontSize: 6.5,
                color: Colors.white,
                height: 1.35,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            value,
            style: GoogleFonts.pressStart2p(
              fontSize: 6.5,
              color: theme.tertiaryColor,
              fontWeight: FontWeight.w700,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}
