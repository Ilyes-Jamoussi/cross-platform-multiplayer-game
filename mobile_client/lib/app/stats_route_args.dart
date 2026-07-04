/// Arguments for [AppRoutes.stats] (game creation → stats).
class StatsRouteArgs {
  const StatsRouteArgs({
    required this.roomId,
    this.gameId,
    this.entryFee = 0,
  });

  final String roomId;
  final String? gameId;
  final int entryFee;
}
