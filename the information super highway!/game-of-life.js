"use strict";
/* jshint esversion: 6 */
var Grid = /** @class */ (function () {
    function Grid(width, height, valuefn) {
        this.width = width;
        this.grid = new Uint8Array(width * height);
        for (var i = 0; i < this.grid.length; i++) {
            this.grid[i] = valuefn();
        }
    }
    Grid.prototype.get = function (x, y) {
        return this.grid[(y * this.width) + x];
    };
    Grid.prototype.set = function (x, y, value) {
        this.grid[(y * this.width) + x] = value;
    };
    Grid.prototype.increment = function (x, y, offset) {
        this.grid[(y * this.width) + x] += offset;
    };
    return Grid;
}());
var World = /** @class */ (function () {
    function World(x, y) {
        this.width = x;
        this.height = y;
        this.state = new Grid(x, y, function () {
            return (Math.random() <= 0.08) ? 1 : 0;
        });
        // Extra padding around our array to avoid needing a bunch of conditionals around the edges of the map
        this.neighbourCounts = new Grid(this.width + 2, this.height + 2, function () { return 0; });
        this.initNeighbourCounts();
    }
    World.prototype.incrementNeighbours = function (x, y, increment) {
        // adjust for our padding
        x += 1;
        y += 1;
        this.neighbourCounts.increment(x - 1, y - 1, increment);
        this.neighbourCounts.increment(x + 1, y - 1, increment);
        this.neighbourCounts.increment(x - 1, y + 1, increment);
        this.neighbourCounts.increment(x + 1, y + 1, increment);
        this.neighbourCounts.increment(x, y - 1, increment);
        this.neighbourCounts.increment(x, y + 1, increment);
        this.neighbourCounts.increment(x - 1, y, increment);
        this.neighbourCounts.increment(x + 1, y, increment);
    };
    World.prototype.initNeighbourCounts = function () {
        for (var x = 0; x < this.width; x++) {
            for (var y = 0; y < this.height; y++) {
                if (this.isAlive(x, y)) {
                    this.incrementNeighbours(x, y, 1);
                }
            }
        }
    };
    World.prototype.neighbourCount = function (x, y) {
        return this.neighbourCounts.get(x + 1, y + 1);
    };
    World.prototype.giveLife = function (x, y) {
        this.incrementNeighbours(x, y, 1);
        this.state.set(x, y, 1);
    };
    World.prototype.takeLife = function (x, y) {
        this.incrementNeighbours(x, y, -1);
        this.state.set(x, y, 0);
    };
    World.prototype.isAlive = function (x, y) {
        return !!this.state.get(x, y);
    };
    World.prototype.tick = function (changes) {
        var _this = this;
        changes.clear();
        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                var neighbourCount = this.neighbourCount(x, y);
                if (this.isAlive(x, y)) {
                    if (neighbourCount !== 2 && neighbourCount !== 3) {
                        changes.deaths.push(x, y);
                    }
                }
                else {
                    if (neighbourCount === 3) {
                        changes.births.push(x, y);
                    }
                }
            }
        }
        changes.deaths.forEach(function (x, y) { _this.takeLife(x, y); });
        changes.births.forEach(function (x, y) { _this.giveLife(x, y); });
    };
    return World;
}());
var PointSet = /** @class */ (function () {
    function PointSet(size) {
        this.xs = new Uint16Array(size);
        this.ys = new Uint16Array(size);
        this.idx = 0;
    }
    PointSet.prototype.push = function (x, y) {
        this.xs[this.idx] = x;
        this.ys[this.idx] = y;
        this.idx += 1;
    };
    PointSet.prototype.clear = function () {
        this.idx = 0;
    };
    PointSet.prototype.forEach = function (fn) {
        for (var i = 0; i < this.idx; i++) {
            fn(this.xs[i], this.ys[i]);
        }
    };
    return PointSet;
}());
var WorldChanges = /** @class */ (function () {
    function WorldChanges(width, height) {
        this.births = new PointSet(width * height);
        this.deaths = new PointSet(width * height);
    }
    WorldChanges.prototype.clear = function () {
        this.births.clear();
        this.deaths.clear();
    };
    return WorldChanges;
}());
var Renderer = /** @class */ (function () {
    function Renderer(world, container, pixelSize) {
        this.debug = false;
        this.world = world;
        this.container = container;
        this.pixelSize = pixelSize;
        this.container.innerHTML = '<canvas class="game-of-life-canvas"></canvas>';
        this.canvas = this.container.querySelector('.game-of-life-canvas');
        this.canvas.width = this.world.width * this.pixelSize;
        this.canvas.height = this.world.height * this.pixelSize;
        this.ctx = this.canvas.getContext('2d');
        this.bitmap = this.ctx.createImageData(this.canvas.width, this.canvas.height);
        // Init all pixels to the right colour but full transparency
        for (var y = 0; y < this.world.height; y++) {
            for (var x = 0; x < this.world.width; x++) {
                for (var offsetY = 0; offsetY < this.pixelSize; offsetY++) {
                    var bitmapY = ((y * this.pixelSize) + offsetY) * 4;
                    for (var offsetX = 0; offsetX < this.pixelSize; offsetX++) {
                        var bitmapX = ((x * this.pixelSize) + offsetX) * 4;
                        var baseIdx = (bitmapY * this.canvas.width) + bitmapX;
                        this.bitmap.data[baseIdx + 0] = Renderer.fillRed;
                        this.bitmap.data[baseIdx + 1] = Renderer.fillGreen;
                        this.bitmap.data[baseIdx + 2] = Renderer.fillBlue;
                        this.bitmap.data[baseIdx + 3] = 0;
                    }
                }
            }
        }
        this.ctx.font = '14px serif';
        this.ctx.fillStyle = '#ff0000';
        this.fps = 0;
    }
    Renderer.prototype.setDebug = function (val) {
        this.debug = val;
    };
    Renderer.prototype.setFPS = function (fps) {
        this.fps = Math.round(fps);
    };
    Renderer.prototype.render = function (changes) {
        var _this = this;
        changes.deaths.forEach(function (x, y) {
            for (var offsetY = 0; offsetY < _this.pixelSize; offsetY++) {
                var bitmapY = ((y * _this.pixelSize) + offsetY) * 4;
                for (var offsetX = 0; offsetX < _this.pixelSize; offsetX++) {
                    var bitmapX = ((x * _this.pixelSize) + offsetX) * 4;
                    _this.bitmap.data[(bitmapY * _this.canvas.width) + bitmapX + 3] = 0;
                }
            }
        });
        /* Fill living pixels */
        changes.births.forEach(function (x, y) {
            for (var offsetY = 0; offsetY < _this.pixelSize; offsetY++) {
                var bitmapY = ((y * _this.pixelSize) + offsetY) * 4;
                for (var offsetX = 0; offsetX < _this.pixelSize; offsetX++) {
                    var bitmapX = ((x * _this.pixelSize) + offsetX) * 4;
                    _this.bitmap.data[(bitmapY * _this.canvas.width) + bitmapX + 3] = Renderer.fillAlpha;
                }
            }
        });
    };
    Renderer.prototype.blit = function () {
        this.ctx.putImageData(this.bitmap, 0, 0);
        if (this.debug) {
            this.ctx.fillText("FPS: ".concat(this.fps), 10, 20);
        }
    };
    Renderer.fillRed = 66;
    Renderer.fillGreen = 31;
    Renderer.fillBlue = 255;
    Renderer.fillAlpha = 255;
    return Renderer;
}());
window.onload = function () {
    var debug = false;
    var maxFPS = debug ? 99999 : 30;
    var pixelSize = 1;
    var margin = pixelSize * 8;
    var world = new World(Math.floor((document.body.offsetWidth - margin) / pixelSize), Math.floor((document.body.offsetHeight - margin) / pixelSize));
    var renderer = new Renderer(world, document.getElementById("game-of-life"), pixelSize);
    renderer.setDebug(debug);
    var lastTick = 0;
    var msPerFrame = (1000.0 / maxFPS);
    var fpsStart = Date.now();
    var fpsCount = 0;
    var changes = new WorldChanges(world.width, world.height);
    var ticker = function () {
        setTimeout(ticker);
        var now = Date.now();
        var delta = now - lastTick;
        if (delta >= msPerFrame) {
            fpsCount += 1;
            lastTick = now - (delta % msPerFrame);
            world.tick(changes);
            renderer.render(changes);
            if (fpsCount === 200) {
                renderer.setFPS(fpsCount / ((now - fpsStart) / 1000.0));
                fpsCount = 0;
                fpsStart = now;
            }
        }
    };
    var blitter = function () {
        requestAnimationFrame(blitter);
        renderer.blit();
    };
    ticker();
    blitter();
};
