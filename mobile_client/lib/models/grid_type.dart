/// Data model for a game (map)
/// Matches the backend Grid interface (@common/interfaces.ts)
class Grid {
  final String id;
  final String name;
  final String description;
  final String gameMode;
  final String state;
  final String owner;
  final String ownerName;
  final int gridSize;
  final int nbActions;
  final String imagePayload;
  final String? lastModified;

  Grid({
    required this.id,
    required this.name,
    required this.description,
    required this.gameMode,
    required this.state,
    required this.owner,
    required this.ownerName,
    required this.gridSize,
    required this.nbActions,
    required this.imagePayload,
    this.lastModified,
  });

  /// Convert JSON (from the server) to Grid
  /// Equivalent of the Angular deserialization
  factory Grid.fromJson(Map<String, dynamic> json) {
    return Grid(
      id: (json['_id'] ?? '') as String,
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      gameMode: json['gameMode'] as String? ?? '',
      state: json['state'] as String? ?? 'public',
      owner: json['owner'] as String? ?? '',
      ownerName: json['ownerName'] as String? ?? '',
      gridSize: json['gridSize'] as int? ?? 10,
      nbActions: json['nbActions'] as int? ?? 1,
      imagePayload: json['imagePayload'] as String? ?? '',
      lastModified: json['lastModified'] as String?,
    );
  }

  /// Convert Grid to JSON (to send to the server)
  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'description': description,
      'gameMode': gameMode,
      'state': state,
      'owner': owner,
      'ownerName': ownerName,
      'gridSize': gridSize,
      'nbActions': nbActions,
      'imagePayload': imagePayload,
      if (lastModified != null) 'lastModified': lastModified,
    };
  }

  /// Copy with modifications (useful for updates)
  Grid copyWith({
    String? id,
    String? name,
    String? description,
    String? gameMode,
    String? state,
    String? owner,
    String? ownerName,
    int? gridSize,
    int? nbActions,
    String? imagePayload,
    String? lastModified,
  }) {
    return Grid(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      gameMode: gameMode ?? this.gameMode,
      state: state ?? this.state,
      owner: owner ?? this.owner,
      ownerName: ownerName ?? this.ownerName,
      gridSize: gridSize ?? this.gridSize,
      nbActions: nbActions ?? this.nbActions,
      imagePayload: imagePayload ?? this.imagePayload,
      lastModified: lastModified ?? this.lastModified,
    );
  }
}
