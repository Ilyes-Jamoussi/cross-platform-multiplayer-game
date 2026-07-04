/// Data model for the user account
/// Correspond au type AccountType du backend (@common/types.ts)
class AccountType {
  final String username;
  final String email;
  final String avatar;
  final String uid;
  final int? virtualCurrency;
  final int? classicWins;
  final int? classicLosses;
  final int? ctfWins;
  final int? ctfLosses;
  final int? gamesPlayedClassic;
  final int? gamesPlayedCTF;
  final int? gamesWon;
  final int? totalGameTime;
  final DateTime? createdAt;
  final DateTime? lastLoginAt;
  /// Server value (`online` | `offline` | `inCombat`) — like the Angular client (`friend.status`).
  final String? status;
  final bool isOnline;
  final List<String> ownedBackgrounds;
  final List<String> ownedAvatars;
  final List<String> ownedMusics;
  final String selectedBackground;
  final String selectedMusic;
  final String theme;

  AccountType({
    required this.username,
    required this.email,
    required this.avatar,
    required this.uid,
    this.virtualCurrency,
    this.classicWins,
    this.classicLosses,
    this.ctfWins,
    this.ctfLosses,
    this.gamesPlayedClassic,
    this.gamesPlayedCTF,
    this.gamesWon,
    this.totalGameTime,
    this.createdAt,
    this.lastLoginAt,
    this.status,
    this.isOnline = false,
    this.ownedBackgrounds = const ['background-default'],
    this.ownedAvatars = const [],
    this.ownedMusics = const ['music-default'],
    this.selectedBackground = 'background-default',
    this.selectedMusic = 'music-default',
    this.theme = 'blue-theme',
  });

  /// Convert JSON (from the server) to AccountType
  /// Equivalent of the Angular deserialization
  factory AccountType.fromJson(Map<String, dynamic> json) {
    final uidValue = (json['uid'] ?? json['firebaseUid']) as String?;
    if (uidValue == null) {
      throw ArgumentError('Missing uid/firebaseUid in AccountType JSON');
    }

    return AccountType(
      username:
          json['username'] as String? ?? 'Utilisateur', // fallback si null
      email: json['email'] as String? ?? '', // fallback si null
      avatar: json['avatar'] as String? ?? '', // fallback si null
      uid: uidValue,
      virtualCurrency: (json['virtualCurrency'] as num?)?.toInt(),
      classicWins: json['classicWins'] as int?,
      classicLosses: json['classicLosses'] as int?,
      ctfWins: json['ctfWins'] as int?,
      ctfLosses: json['ctfLosses'] as int?,
      gamesPlayedClassic: (json['gamesPlayedClassic'] as num?)?.toInt(),
      gamesPlayedCTF: (json['gamesPlayedCTF'] as num?)?.toInt(),
      gamesWon: (json['gamesWon'] as num?)?.toInt(),
      totalGameTime: (json['totalGameTime'] as num?)?.toInt(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) // sécurité parse
          : null,
      lastLoginAt: json['lastLoginAt'] != null
          ? DateTime.tryParse(json['lastLoginAt'] as String)
          : null,
      status: json['status'] as String?,
      isOnline: _parseOnlineFlag(json),
      ownedBackgrounds: (json['ownedBackgrounds'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const ['background-default'],
      ownedAvatars: (json['ownedAvatars'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      ownedMusics: (json['ownedMusics'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const ['music-default'],
      selectedBackground:
          json['selectedBackground'] as String? ?? 'background-default',
      selectedMusic: json['selectedMusic'] as String? ?? 'music-default',
      theme: json['theme'] as String? ?? 'blue-theme',
    );
  }

  static bool _parseOnlineFlag(Map<String, dynamic> json) {
    final explicit = json['isOnline'] as bool?;
    if (explicit != null) return explicit;
    final s = json['status'] as String?;
    return s == 'online' || s == 'inCombat';
  }

  /// Convert AccountType to JSON (to send to the server)
  /// Equivalent of the serialization
  Map<String, dynamic> toJson() {
    return {
      'username': username,
      'email': email,
      'avatar': avatar,
      'uid': uid,
      if (virtualCurrency != null) 'virtualCurrency': virtualCurrency,
      if (classicWins != null) 'classicWins': classicWins,
      if (classicLosses != null) 'classicLosses': classicLosses,
      if (ctfWins != null) 'ctfWins': ctfWins,
      if (ctfLosses != null) 'ctfLosses': ctfLosses,
      if (gamesPlayedClassic != null) 'gamesPlayedClassic': gamesPlayedClassic,
      if (gamesPlayedCTF != null) 'gamesPlayedCTF': gamesPlayedCTF,
      if (gamesWon != null) 'gamesWon': gamesWon,
      if (totalGameTime != null) 'totalGameTime': totalGameTime,
      if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
      if (lastLoginAt != null) 'lastLoginAt': lastLoginAt!.toIso8601String(),
      if (status != null) 'status': status,
      'isOnline': isOnline,
      'ownedBackgrounds': ownedBackgrounds,
      'ownedAvatars': ownedAvatars,
      'ownedMusics': ownedMusics,
      'selectedBackground': selectedBackground,
      'selectedMusic': selectedMusic,
      'theme': theme,
    };
  }

  /// Copy with modifications (useful for updates)
  AccountType copyWith({
    String? username,
    String? email,
    String? avatar,
    String? uid,
    int? virtualCurrency,
    int? classicWins,
    int? classicLosses,
    int? ctfWins,
    int? ctfLosses,
    int? gamesPlayedClassic,
    int? gamesPlayedCTF,
    int? gamesWon,
    int? totalGameTime,
    DateTime? createdAt,
    DateTime? lastLoginAt,
    String? status,
    bool? isOnline,
    List<String>? ownedBackgrounds,
    List<String>? ownedAvatars,
    List<String>? ownedMusics,
    String? selectedBackground,
    String? selectedMusic,
    String? theme,
  }) {
    return AccountType(
      username: username ?? this.username,
      email: email ?? this.email,
      avatar: avatar ?? this.avatar,
      uid: uid ?? this.uid,
      virtualCurrency: virtualCurrency ?? this.virtualCurrency,
      classicWins: classicWins ?? this.classicWins,
      classicLosses: classicLosses ?? this.classicLosses,
      ctfWins: ctfWins ?? this.ctfWins,
      ctfLosses: ctfLosses ?? this.ctfLosses,
      gamesPlayedClassic: gamesPlayedClassic ?? this.gamesPlayedClassic,
      gamesPlayedCTF: gamesPlayedCTF ?? this.gamesPlayedCTF,
      gamesWon: gamesWon ?? this.gamesWon,
      totalGameTime: totalGameTime ?? this.totalGameTime,
      createdAt: createdAt ?? this.createdAt,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      status: status ?? this.status,
      isOnline: isOnline ?? this.isOnline,
      ownedBackgrounds: ownedBackgrounds ?? this.ownedBackgrounds,
      ownedAvatars: ownedAvatars ?? this.ownedAvatars,
      ownedMusics: ownedMusics ?? this.ownedMusics,
      selectedBackground: selectedBackground ?? this.selectedBackground,
      selectedMusic: selectedMusic ?? this.selectedMusic,
      theme: theme ?? this.theme,
    );
  }
}
