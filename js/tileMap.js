import * as THREE from 'three';

// Tile size in world units
export const TILE_SIZE = 1;
export const MAP_WIDTH = 30;
export const MAP_HEIGHT = 30;

export const TileType = {
    FLOOR: 0,
    WALL: 1
};

export class TileMap {
    constructor(scene) {
        this.scene = scene;
        this.width = MAP_WIDTH;
        this.height = MAP_HEIGHT;
        this.tiles = this.generateMap();

        // Visual grid
        this.gridMesh = null;
        this.hoverIndicator = null;
        this.pathIndicators = [];

        this.createVisualGrid();
        this.createHoverIndicator();
    }

    generateMap() {
        const tiles = [];
        for (let y = 0; y < this.height; y++) {
            tiles[y] = [];
            for (let x = 0; x < this.width; x++) {
                tiles[y][x] = TileType.FLOOR;
            }
        }
        return tiles;
    }

    createVisualGrid() {
        // Create a grid of lines to show tiles
        const gridHelper = new THREE.GridHelper(
            Math.max(this.width, this.height) * TILE_SIZE,
            Math.max(this.width, this.height),
            0x444466,
            0x333344
        );
        gridHelper.position.set(
            (this.width * TILE_SIZE) / 2 - TILE_SIZE / 2,
            0.01,
            (this.height * TILE_SIZE) / 2 - TILE_SIZE / 2
        );
        this.scene.add(gridHelper);
        this.gridMesh = gridHelper;

        // Create ground plane
        const groundGeometry = new THREE.PlaneGeometry(
            this.width * TILE_SIZE,
            this.height * TILE_SIZE
        );
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a4a2a,
            roughness: 0.9
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(
            (this.width * TILE_SIZE) / 2 - TILE_SIZE / 2,
            0,
            (this.height * TILE_SIZE) / 2 - TILE_SIZE / 2
        );
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.groundMesh = ground;
    }

    createHoverIndicator() {
        // Square indicator for hovered tile
        const geometry = new THREE.PlaneGeometry(TILE_SIZE * 0.9, TILE_SIZE * 0.9);
        const material = new THREE.MeshBasicMaterial({
            color: 0x44ff44,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        this.hoverIndicator = new THREE.Mesh(geometry, material);
        this.hoverIndicator.rotation.x = -Math.PI / 2;
        this.hoverIndicator.position.y = 0.02;
        this.hoverIndicator.visible = false;
        this.scene.add(this.hoverIndicator);
    }

    // Convert world position to tile coordinates
    worldToTile(worldX, worldZ) {
        return {
            x: Math.floor(worldX / TILE_SIZE + 0.5),
            y: Math.floor(worldZ / TILE_SIZE + 0.5)
        };
    }

    // Convert tile coordinates to world position (center of tile)
    tileToWorld(tileX, tileY) {
        return {
            x: tileX * TILE_SIZE,
            y: 0,
            z: tileY * TILE_SIZE
        };
    }

    getTile(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return TileType.WALL;
        }
        return this.tiles[Math.floor(y)][Math.floor(x)];
    }

    isWalkable(x, y) {
        return this.getTile(Math.floor(x), Math.floor(y)) === TileType.FLOOR;
    }

    isInBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    // Show hover indicator at tile position
    showHoverAt(tileX, tileY) {
        if (this.isInBounds(tileX, tileY)) {
            const worldPos = this.tileToWorld(tileX, tileY);
            this.hoverIndicator.position.x = worldPos.x;
            this.hoverIndicator.position.z = worldPos.z;
            this.hoverIndicator.visible = true;
        } else {
            this.hoverIndicator.visible = false;
        }
    }

    hideHover() {
        this.hoverIndicator.visible = false;
    }

    // Show path indicators
    showPath(path) {
        this.clearPath();

        for (const point of path) {
            const geometry = new THREE.PlaneGeometry(TILE_SIZE * 0.4, TILE_SIZE * 0.4);
            const material = new THREE.MeshBasicMaterial({
                color: 0x4444ff,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide
            });
            const indicator = new THREE.Mesh(geometry, material);
            indicator.rotation.x = -Math.PI / 2;
            indicator.position.set(point.x * TILE_SIZE, 0.03, point.y * TILE_SIZE);
            this.scene.add(indicator);
            this.pathIndicators.push(indicator);
        }
    }

    clearPath() {
        for (const indicator of this.pathIndicators) {
            this.scene.remove(indicator);
            indicator.geometry.dispose();
            indicator.material.dispose();
        }
        this.pathIndicators = [];
    }

    // Simple A* pathfinding
    findPath(startX, startY, endX, endY) {
        startX = Math.floor(startX);
        startY = Math.floor(startY);
        endX = Math.floor(endX);
        endY = Math.floor(endY);

        if (!this.isWalkable(endX, endY)) {
            return null;
        }

        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();

        const gScore = new Map();
        const fScore = new Map();

        const startKey = `${startX},${startY}`;
        const endKey = `${endX},${endY}`;

        openSet.push({ x: startX, y: startY });
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startX, startY, endX, endY));

        while (openSet.length > 0) {
            // Find node with lowest fScore
            let current = openSet[0];
            let currentIndex = 0;
            for (let i = 1; i < openSet.length; i++) {
                const key = `${openSet[i].x},${openSet[i].y}`;
                const currentKey = `${current.x},${current.y}`;
                if ((fScore.get(key) || Infinity) < (fScore.get(currentKey) || Infinity)) {
                    current = openSet[i];
                    currentIndex = i;
                }
            }

            const currentKey = `${current.x},${current.y}`;

            if (current.x === endX && current.y === endY) {
                // Reconstruct path
                const path = [];
                let node = current;
                while (node) {
                    path.unshift({ x: node.x, y: node.y });
                    const key = `${node.x},${node.y}`;
                    node = cameFrom.get(key);
                }
                return path;
            }

            openSet.splice(currentIndex, 1);
            closedSet.add(currentKey);

            // Check neighbors (4-directional)
            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 },
                { x: current.x, y: current.y - 1 },
                // Diagonals
                { x: current.x + 1, y: current.y + 1 },
                { x: current.x - 1, y: current.y - 1 },
                { x: current.x + 1, y: current.y - 1 },
                { x: current.x - 1, y: current.y + 1 }
            ];

            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;

                if (closedSet.has(neighborKey)) continue;
                if (!this.isWalkable(neighbor.x, neighbor.y)) continue;

                // Diagonal movement cost is sqrt(2)
                const isDiagonal = neighbor.x !== current.x && neighbor.y !== current.y;
                const moveCost = isDiagonal ? 1.414 : 1;

                const tentativeG = (gScore.get(currentKey) || 0) + moveCost;

                const existingG = gScore.get(neighborKey);
                if (existingG === undefined || tentativeG < existingG) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + this.heuristic(neighbor.x, neighbor.y, endX, endY));

                    if (!openSet.find(n => n.x === neighbor.x && n.y === neighbor.y)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }

        return null; // No path found
    }

    heuristic(x1, y1, x2, y2) {
        // Euclidean distance
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    dispose() {
        if (this.gridMesh) {
            this.scene.remove(this.gridMesh);
        }
        if (this.groundMesh) {
            this.scene.remove(this.groundMesh);
            this.groundMesh.geometry.dispose();
            this.groundMesh.material.dispose();
        }
        if (this.hoverIndicator) {
            this.scene.remove(this.hoverIndicator);
            this.hoverIndicator.geometry.dispose();
            this.hoverIndicator.material.dispose();
        }
        this.clearPath();
    }
}
