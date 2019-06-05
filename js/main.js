let mapW = 10000;
let mapH = 10000;

let lastTime = 0;

const gridSize = 100;
const frameRate = 30;
const frameDelay = 1000 / frameRate;

const buttonCooldownFrames = 10;

const hexCodes = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];

const barGridSpacing = 4;

let canvas = document.getElementById("maincanvas");
let ctx = canvas.getContext("2d");


let gridCanvas = document.getElementById("gridcanvas");
let gridCtx = gridCanvas.getContext("2d");


let btnCanvas = document.getElementById("btncanvas");
let btnCtx = btnCanvas.getContext("2d");

let gameState = {
    state: 0,
    default: 0,
    panning: 1,
    dragging: 2,
    building: 3
}

let lastMX = 0;
let lastMY = 0;

function getMiliTime() {
    return new Date().getTime();
}

function clockwiseIntersectionHelper(x1, y1, x2, y2, x3, y3) {
    return (y3 - y1) * (x2 - x1) > (y2 - y1) * (x3 - x1);
}

function teeIntersectionHelper(x1, y1, x2, y2, x3, y3) {
    return (y3 - y1) * (x2 - x1) == (y2 - y1) * (x3 - x1);
}

function intersectionCheck(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
    return clockwiseIntersectionHelper(ax1, ay1, bx1, by1, bx2, by2) != clockwiseIntersectionHelper(ax2, ay2, bx1, by1, bx2, by2) && 
        clockwiseIntersectionHelper(ax1, ay1, ax2, ay2, bx1, by1) != clockwiseIntersectionHelper(ax1, ay1, ax2, ay2, bx2, by2) &&
        !teeIntersectionHelper(ax1, ay1, ax2, ay2, bx1, by1) && !teeIntersectionHelper(ax1, ay1, ax2, ay2, bx2, by2) &&
        !teeIntersectionHelper(ax1, ay1, bx1, by1, bx2, by2) && !teeIntersectionHelper(ax2, ay2, bx1, by1, bx2, by2);
}

function Spangle(x, y) { // a four-pointed star icon
    this.x = x;
    this.y = y;
    this.len = 10;
    this.border = "#88F";
    this.bigborder = "#FFD700";
    this.fill = "#FFF";
    this.curveP = 0.5;
    this.hovering = false;
    this.hard = false;
    this.draw = function(c, offX, offY) {
        let tx = (this.x) - offX;
        let ty = (this.y) - offY;
        let nlen = this.len * camera.res;
        let pOff = nlen / 2 * (1 - this.curveP);
        c.fillStyle = this.fill;
        if (this.hovering) {
            if (!checkSpangleAtPoint(lastMX * camera.res + camera.lEdge, lastMY * camera.res + camera.tEdge, this)) {
                this.hovering = false;
            }
            c.strokeStyle = this.bigborder;
            c.lineWidth = 5 * camera.res;
        } else {
            c.strokeStyle = this.border;
            c.lineWidth = 2 * camera.res;
        }
        c.beginPath();

        c.moveTo(tx - nlen, ty);
        c.quadraticCurveTo(tx - pOff, ty - pOff, tx, ty - nlen);
        c.quadraticCurveTo(tx + pOff, ty - pOff, tx + nlen, ty);
        c.quadraticCurveTo(tx + pOff, ty + pOff, tx, ty + nlen);
        c.quadraticCurveTo(tx - pOff, ty + pOff, tx - nlen, ty);

        c.fill();
        c.stroke();
    },
    this.isOrphaned = function() {
        for (let i = 0; i < barPlacers.length; i++) {
            if (barPlacers[i].x1 == x && barPlacers[i].y1 == y || barPlacers[i].x2 == x && barPlacers[i].y2 == y) {
                return false;
            }
        }
        return true;
    }
}

let spangles = [];

// test spangle
let mcenterx = Math.floor(mapW / 2 / gridSize / barGridSpacing) * gridSize * barGridSpacing;
let mcentery = Math.floor(mapH / 2 / gridSize / barGridSpacing) * gridSize * barGridSpacing;
spangles.push(new Spangle (mcenterx, mcentery));
spangles.push(new Spangle (mcenterx + 3 * (gridSize * barGridSpacing), mcentery));
spangles[0].hard = true;
spangles[1].hard = true;

function Button(x, y, w, h, act, draw, collide) {
    this.x = x;
    this.y = y;
    this.width = w;
    this.height = h;
    this.toggle = false;
    this.cooldown = 0;
    this.press = function() {
        if (this.cooldown == 0) {
            this.act();
            this.cooldown = buttonCooldownFrames;
        }
    }
    if (act !== undefined) {
        this.act = act;
    } else {
        this.act = function() { this.toggle = !this.toggle; }
    }
    if (draw !== undefined) {
        this.draw = draw;
    } else {
        this.draw = function(c) {
            let tx = this.x;
            let ty = this.y;
            c.lineWidth = 3;
            if (this.toggle) {
                c.strokeStyle = "#800";
                c.fillStyle = "#c44";
            } else {
                c.fillStyle = "#800"
                c.strokeStyle = "#000";
            }
            c.beginPath();
            c.moveTo(tx, ty);
            c.lineTo(tx + this.width, ty);
            c.lineTo(tx + this.width, ty + this.height);
            c.lineTo(tx, ty + this.height);
            c.closePath();
            c.fill();
            c.stroke();
        }
    }
    if (collide !== undefined) {
        this.collide = collide;
    } else {
        this.collide = function(x, y) {
            return (this.x < x && this.x + this.width > x && this.y < y && this.y + this.height > y);
        }
    }
}

let buttons = [];

function bottomButtonDraw(c) {
    c.lineWidth = 3;
    if (this.toggle) {
        c.strokeStyle = "#800";
        c.fillStyle = "#c44";
    } else {
        c.fillStyle = "#800"
        c.strokeStyle = "#000";
    }
    let oy = c.canvas.height - this.y - this.height;
    c.beginPath();
    c.moveTo(this.x, oy);
    c.lineTo(this.x + this.width, oy);
    c.lineTo(this.x + this.width, oy + this.height);
    c.lineTo(this.x, oy + this.height);
    c.closePath();
    c.fill();
    c.stroke();

    if (this.drawSym !== undefined) {
        this.drawSym(c);
    }
}

function bottomButtonDetect(x, y) {
    let oy = btnCanvas.height - this.y - this.height;
    return this.x < x && this.x + this.width > x && oy < y && oy + this.height > y;
}

function groupAction() {
    for (let i = this.group; i < buttons.length && buttons[i].group == this.group; i++) {
        buttons[i].toggle = false;
    }
    this.toggle = true;
}

for (let i = 0; i < 3; i++) {
    let b = new Button (50 + i * 50, 50, 40, 40, groupAction, bottomButtonDraw, bottomButtonDetect);
    b.group = 0;
    buttons.push(b);
}

buttons[0].toggle = true;

buttons.push(new Button(40, 40, 40, 40));  // triangle toggle
buttons.push(new Button(100, 40, 40, 40, function () {
    this.toggle = !this.toggle;
    if (this.toggle) {
        physEng.didInit = false; // async issues
        physEng.init();
    }
})); // physics toggle

let gridLineInfo = {
    smWid: 1,
    lgWid: 3,
    colorStr: "#888",
    gridCanvasRpt: 10,
    transparency: 0.5
}

let barTypes = {
    b: {
        maxLen: barGridSpacing,
        flex: 0.2,
        stress: 0.5,
        width: 5,
        color: "#000000",
        isSupport: false,
        weight: 0.01,
        flexPow: 0.1
    },
    s: {
        maxLen: barGridSpacing,
        flex: 0.2,
        stress: 0.5,
        width: 5,
        color: "#A52A2A",
        isSupport: true,
        weight: 0.01,
        flexPow: 0.1
    }
}

function BarPlacer(x1, y1, x2, y2, type) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.type = type;
    this.hovering = false;
    this.didBreak = false;
    this.draw = function(c, offX, offY) {
        if (this.didBreak) {
            c.strokeStyle = "#F00";
            c.lineWidth = this.type.width * 3 * gridSize / 20;
            c.beginPath();
            c.moveTo(this.x1 - offX, this.y1 - offY);
            c.lineTo(this.x2 - offX, this.y2 - offY);
            c.stroke();
        }
        if (this.hovering) {
            if (!checkBarAtPoint(lastMX * camera.res + camera.lEdge, lastMY * camera.res + camera.tEdge, this)) {
                this.hovering = false;
            }

            c.strokeStyle = "#FFD700";
            c.lineWidth = this.type.width * 3 * gridSize / 20;
            c.beginPath();
            c.moveTo(this.x1 - offX, this.y1 - offY);
            c.lineTo(this.x2 - offX, this.y2 - offY);
            c.stroke();
        }
        c.strokeStyle = this.type.color;
        c.lineWidth = this.type.width * gridSize / 20;

        c.beginPath();
        c.moveTo(this.x1 - offX, this.y1 - offY);
        c.lineTo(this.x2 - offX, this.y2 - offY);
        c.stroke();
    },
    this.reform = function() {
        // make sure bars all go in consistent directions
        if (this.y1 > this.y2 || this.y1 == this.y2 && this.x1 > this.x2) {
            let tx = this.x1; 
            let ty = this.y1;
            this.x1 = this.x2;
            this.y1 = this.y2;
            this.x2 = tx;
            this.y2 = ty;
        }
    },
    this.checkCollide = function(bar) {
        if (this.x1 == bar.x2 && this.y1 == bar.y2 || this.x2 == bar.x1 && this.y2 == bar.y1) {
            return false; // connected at edges
        }
        let ata = Math.atan2(this.y2 - this.y1, this.x2 - this.x1);
        if (ata == Math.atan2(bar.y2 - bar.y1, bar.x2 - bar.x1)) {
            // bars are parallel
            if (ata == Math.atan2(bar.y2 - this.y1, bar.x2 - this.x1) && ata == Math.atan2(this.y2 - bar.y1, this.x2 - bar.x1)) {
                return true;
            }
        } else if (intersectionCheck(bar.x1, bar.y1, bar.x2, bar.y2, this.x1, this.y1, this.x2, this.y2)) {
            // lines intersect
            return true;
        }
        return false;
    }
}

let barPlacers = [];
let barCursor = new BarPlacer();

barCursor.drawToNearbySpangles = function(c, offX, offY) {
    if (barCursor.type.isSupport && buttons[3].toggle && (barCursor.x1 != barCursor.x2 || barCursor.y1 != barCursor.y2)) {
        for (let i = 0; i < spangles.length; i++) {
            let sp = spangles[i];
            let d = Math.sqrt(dist2(sp.x, this.x2, sp.y, this.y2));
            if (d <= this.type.maxLen * gridSize + gridSize / 2) { // TODO : more checks
                let btest = new BarPlacer(sp.x, sp.y, this.x2, this.y2, barCursor.type);
                btest.reform();
                let didIntersect = false;
                for (let j = 0; j < barPlacers.length; j++) {
                    if (btest.checkCollide(barPlacers[j])) {
                        didIntersect = true;
                        break;
                    }
                }
                if (!didIntersect) {
                    c.lineWidth = this.type.width * gridSize / 20;

                    c.beginPath();
                    c.moveTo(sp.x - offX, sp.y - offY);
                    c.lineTo(this.x2 - offX, this.y2 - offY);
                    c.stroke();
                }
            }
        }
    }
}

let frameCounter = {
    vals: [],
    maxVals: 1,
    idx: 0,
    push: function(val) {
        if (this.vals.length < this.maxVals) {
            this.vals.push(val);
        } else {
            this.vals[this.idx] = val;
        }
        this.idx = (this.idx + 1) % this.maxVals;
    },
    getAverage: function() {
        let a = 0;
        for (let i = 0; i < this.vals.length; i++) {
            a += this.vals[i];
        }
        return a / this.maxVals;
    }
}

function PhysBar(i, b, alen, o) {
    this.type = b;
    this.index = i;
    this.stress = 0;
    this.len = alen;
    this.oldBar = o;
}

function PhysPoint(x, y) {
    this.x = x;
    this.y = y;
    this.bars = [];
    this.v = {x: 0, y: 0};
    this.f = {x: 0, y: 0};
    this.hard = false;
    this.mass = 0.0;
    this.calcMass = function() {
        this.mass = 0.001;
        for (let i = 0; i < this.bars.length; i++) {
            this.mass += this.bars[i].len * this.bars[i].type.weight;
        }
    }
}

let physEng = {
    gravity: 1,
    barGravityInc: 0.1,
    airRes: 0.05,
    halt: 0.01,
    rate: 5,
    speedCap: 5,
    points: [],
    didInit: false,
    firstBreak: false,


    init: function() {
        this.points = [];
        for (let i = 0; i < spangles.length; i++) {
            this.points.push(new PhysPoint(spangles[i].x, spangles[i].y));
            this.points[i].hard = spangles[i].hard;
        }
        for (let i = 0; i < barPlacers.length; i++) {
            let i1 = findSpangleAtPoint(barPlacers[i].x1, barPlacers[i].y1);
            let i2 = findSpangleAtPoint(barPlacers[i].x2, barPlacers[i].y2);
            let dist = Math.sqrt(dist2(barPlacers[i].x1, barPlacers[i].x2, barPlacers[i].y1, barPlacers[i].y2));

            // reasonably, we could do this only once, for the lesser index of i1 and i2
            this.points[i1].bars.push(new PhysBar(i2, barPlacers[i].type, dist, i));
            this.points[i2].bars.push(new PhysBar(i1, barPlacers[i].type, dist, i));
            barPlacers[i].didBreak = false;
        }
        for (let i = 0; i < spangles.length; i++) {
            this.points[i].calcMass();
        }
        this.didInit = true;
        this.firstBreak = false;
    },
    draw: function(c, offX, offY) {
        // draw each bar
        for (let i = 0; i < this.points.length; i++) {
            for (let j = 0; j < this.points[i].bars.length; j++) {
                if (this.points[i].bars[j].index > i) { // don't repeat draws
                    let b = this.points[i].bars[j];

                    // draw the bar stress first
                    let strRC = Math.min(Math.floor(b.stress * 16), 15);
                    let strGC = Math.min(16 - strRC, 15);
                    
                    c.strokeStyle = "#" + hexCodes[strRC] + hexCodes[strGC] + "0";
                    c.lineWidth = 3 * b.type.width * gridSize / 20;
                    c.beginPath();
                    c.moveTo(this.points[i].x - offX, this.points[i].y - offY);
                    c.lineTo(this.points[b.index].x - offX, this.points[b.index].y - offY);
                    c.stroke();

                    c.strokeStyle = b.type.color;
                    c.lineWidth = b.type.width * gridSize / 20;
                    c.beginPath();
                    c.moveTo(this.points[i].x - offX, this.points[i].y - offY);
                    c.lineTo(this.points[b.index].x - offX, this.points[b.index].y - offY);
                    c.stroke();
                }
            }
            // once we're here, the point can be drawn overtop
            c.strokeStyle = "#000000";
            c.fillStyle = "#FFFFFF";
            c.lineWidth = 2 * gridSize / 20;
            c.beginPath();
            c.arc(this.points[i].x - offX, this.points[i].y - offY, 10 * gridSize / 20, 0, 2 * Math.PI);
            c.fill();
            c.stroke();
        }
    },
    cycle: function() {
        // engage all physics
        // first, apply gravity to each point
        // gravity is multiplied by the weight of the connecting bars
        for (let i = 0; i < this.points.length; i++) {
            // make this loop separate for initializations
            this.points[i].f.y = this.gravity * this.points[i].mass * this.barGravityInc;
            this.points[i].f.x = 0;
        }
        for (let i = 0; i < this.points.length; i++) {
            // TODO: apply weights
            // apply bar flex to each point, as a function of the bar stretch
            for (let j = 0; j < this.points[i].bars.length; j++) {
                if (this.points[i].bars[j].index > i) {
                    let bmlen = this.points[i].bars[j].len;
                    let balen = Math.sqrt(dist2(this.points[i].x, this.points[this.points[i].bars[j].index].x, this.points[i].y, this.points[this.points[i].bars[j].index].y));
                    let magf = (1.0 - this.points[i].bars[j].type.flexPow) * (bmlen - balen);
                    //if (bmlen - balen < magf) magf = bmlen - balen;
                    let xf = (this.points[this.points[i].bars[j].index].x - this.points[i].x) * magf / balen;
                    let yf = (this.points[this.points[i].bars[j].index].y - this.points[i].y) * magf / balen;
                    this.points[i].f.x -= xf;    // I might have these signs backwards
                    this.points[i].f.y -= yf;
                    this.points[this.points[i].bars[j].index].f.x += xf;
                    this.points[this.points[i].bars[j].index].f.y += yf;
                    //console.log(xf);
                    //console.log(this.points[i].f.x);

                    // update the bar stress
                    this.points[i].bars[j].stress = Math.abs(bmlen - balen) / (this.points[i].bars[j].type.flex * gridSize);
                    let idx = this.points[i].bars[j].index;
                    for (let j2 = 0; j2 < this.points[idx].bars.length; j2++) {
                        if (this.points[idx].bars[j2].index == i) {
                            this.points[idx].bars[j2].stress = this.points[i].bars[j].stress;
                            break; 
                        }
                    }
                }
            }
        }


        // that should be all FORCES. now resolve the accelerations.
        // ignore this entirely if the point is hard
        for (let i = 0; i < this.points.length; i++) {
            if (!this.points[i].hard) {
                // first, convert force to acceleration, then to velocity
                //console.log(this.points[i].v.x + "(" + this.points[i].f.x + ")");
                this.points[i].v.x += this.points[i].f.x * this.rate / this.points[i].mass;
                this.points[i].v.y += this.points[i].f.y * this.rate / this.points[i].mass;
                //console.log(this.points[i].v.x);

                // decay each force by the air resistance
                this.points[i].v.x *= (1.0 - this.airRes);
                this.points[i].v.y *= (1.0 - this.airRes);
                if (Math.abs(this.points[i].v.x) < this.halt) {
                    this.points[i].v.x = 0;
                }
                if (Math.abs(this.points[i].v.y) < this.halt) {
                    this.points[i].v.y = 0;
                }
                if (Math.abs(this.points[i].v.x) > this.speedCap) {
                    this.points[i].v.x = this.points[i].v.x > 0 ? this.speedCap : (this.speedCap * -1);
                }
                if (Math.abs(this.points[i].v.y) > this.speedCap) {
                    this.points[i].v.y = this.points[i].v.y > 0 ? this.speedCap : (this.speedCap * -1);
                }
                // convert 
                this.points[i].x += this.points[i].v.x;
                this.points[i].y += this.points[i].v.y;
            }
        }
        
        let rem = false;

        for (let i = 0; i < this.points.length; i++) {
            for (let j = 0; j < this.points[i].bars.length; j++) {
                if (this.points[i].bars[j].index > i) {
                    let bmlen = this.points[i].bars[j].len;
                    let balen = Math.sqrt(dist2(this.points[i].x, this.points[this.points[i].bars[j].index].x, this.points[i].y, this.points[this.points[i].bars[j].index].y));
                    if (Math.abs(bmlen - balen) > this.points[i].bars[j].type.flex * gridSize) {
                        console.log(Math.abs(bmlen - balen));
                        // remove bar
                        if (!this.firstBreak) {
                            barPlacers[this.points[i].bars[j].oldBar].didBreak = true;
                            this.firstBreak = true;
                        }
                        rem = true;
                        let idx = this.points[i].bars[j].index;
                        this.points[i].bars.splice(j, 1);
                        j--;
                        for (let z = 0; z < this.points[idx].bars.length; z++) {
                            if (this.points[idx].bars[z].index == i) {
                                this.points[idx].bars.splice(z, 1);
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (rem) {
            // verify all points
            // since all bars are double-stored, if a point has an empty bar array it has no bars
            for (let i = 0; i < this.points.length; i++) {
                if (this.points[i].bars.length == 0 && !this.points[i].hard) {
                    this.points.splice(i, 1);
                    // anything that was pointing above this index needs to be decremented
                    for (let j = 0; j < this.points.length; j++) {
                        for (let j2 = 0; j2 < this.points[j].bars.length; j2++) {
                            if (this.points[j].bars[j2].index > i) {
                                this.points[j].bars[j2].index--;
                            }
                        }
                    }
                    i--;
                } else {
                    this.points[i].calcMass();
                }
            }
        }
    }
}

let camera = {
    x: mapW / 2,
    y: mapH / 2,
    res: 6,
    lEdge: 0,
    rEdge: 0,
    tEdge: 0,
    bEdge: 0,
    resize: function() {
        canvas.width = canvas.offsetWidth * this.res;
        canvas.height = canvas.offsetHeight * this.res;
        resizeBtnCanvas();
    },
    drawScene: function() {
        // clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        this.lEdge = Math.floor(this.x - canvas.width / 2);
        this.tEdge = Math.floor(this.y - canvas.height / 2);
        this.rEdge = Math.floor(this.x + canvas.width / 2);
        this.bEdge = Math.floor(this.y + canvas.height / 2);

        let gw = 0;
        let gh = 0;
        
        if (buttons[4].toggle) {
            if (physEng.didInit) {
                physEng.cycle();
                physEng.draw(ctx, this.lEdge, this.tEdge);
            }
        } else {
            // draw canvas grid(s)

            let lst = 0 - (this.lEdge % (gridSize * barGridSpacing));
            let tst = 0 - (this.tEdge % (gridSize * barGridSpacing));

            for (let i = lst; i < canvas.width; i += gridCanvas.width) {
                for (let j = tst; j < canvas.height; j += gridCanvas.height) {
                    ctx.drawImage(gridCanvas, i, j);
                }
            }

            // draw bars
            if (gameState.state == gameState.building) {
                barCursor.draw(ctx, this.lEdge, this.tEdge);
                barCursor.drawToNearbySpangles(ctx, this.lEdge, this.tEdge);
            }
            barPlacers.forEach(b => b.draw(ctx, this.lEdge, this.tEdge));

            ctx.lineWidth = 1;
            spangles.forEach(s => s.draw(ctx, this.lEdge, this.tEdge));
        }

        ctx.font = "30px Arial";
        ctx.fillStyle = "#000";
        ctx.fillText(Math.floor(frameCounter.getAverage() * 10) / 10, 50, 50);

        redrawBtnCanvas();
        ctx.drawImage(btnCanvas, 0, 0, canvas.width, canvas.height);
        //buttons.forEach(b => b.draw(ctx, camera.res));
        //spangTest.draw(ctx, this.lEdge, this.tEdge);
    }
}

function checkSpangleAtPoint(x, y, s) {
    return (s.x - gridSize / 2 < x && s.x + gridSize / 2 > x && 
        s.y - gridSize / 2 < y && s.y + gridSize / 2 > y);
}

function findSpangleAtPoint(x, y) {
    for (let i = 0; i < spangles.length; i++) {
        if (checkSpangleAtPoint(x, y, spangles[i])) {
                return i;
            }
    }
    return -1;
}

function findButtonAtPoint(x, y) {
    for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].collide(x, y)) {
            return i;
        }
    }
    return -1;
}

function dist2(x1, x2, y1, y2) { return (x2 - x1)*(x2 - x1) + (y2 - y1)*(y2 - y1) }
function distToSegmentSquared(x1, x2, y1, y2, px, py) {
  let l2 = dist2(x1, x2, y1, y2);
  if (l2 == 0) return dist2(px, x1, py, y1);
  let t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2));
  return dist2(px, x1 + t * (x2 - x1), py, y1 + t * (y2 - y1) );
}

function checkBarAtPoint(x, y, b) {
    let d = Math.sqrt(distToSegmentSquared(b.x1, b.x2, b.y1, b.y2, x, y));
    return d < gridSize / 4;
}

// interface controls
function onMouseDown(evt) {
    if (evt.touches) {
        lastMX = evt.touches[0].clientX;
        lastMY = evt.touches[0].clientY;
    } else {
        lastMX = evt.clientX;
        lastMY = evt.clientY;
    }
    // detect what the mouse is over
    // if over a button, try to click it
    let itemIdx = findButtonAtPoint(lastMX, lastMY);
    if (itemIdx != -1) {
        buttons[itemIdx].press();
        return;
    }

    // if we haven't hit buttons and we're in physics mode, only allow panning
    if (buttons[4].toggle) {
        gameState.state = gameState.panning;
        return;
    }

    if (buttons[2].toggle) {
        // search for any bars in contact; if so, delete them
        // bars that have a hover state on have already been verified
        let diddel = false;
        for (let i = 0; i < barPlacers.length; i++) {
            if (barPlacers[i].hovering) {
                diddel = true;
                barPlacers.splice(i, 1);
                i--;
            }
        }
        // remove orphaned spangles
        for (let i = 0; i < spangles.length; i++) {
            if (!spangles[i].hard && spangles[i].isOrphaned()) {
                spangles.splice(i, 1);
                i--;
            }
        }
        if (diddel) {
            return;
        }
    }

    // if over a spangle, start a drag
    // if over the map, pan it
    let spInd = findSpangleAtPoint(lastMX * camera.res + camera.lEdge, lastMY * camera.res + camera.tEdge);
    if (spInd != -1 && !buttons[2].toggle) { 
        gameState.state = gameState.building;
        barCursor.x1 = spangles[spInd].x;
        barCursor.y1 = spangles[spInd].y;
        barCursor.x2 = barCursor.x1;
        barCursor.y2 = barCursor.y1;
        if (buttons[0].toggle) {
            barCursor.type = barTypes.b;
        } else if (buttons[1].toggle) {
            barCursor.type = barTypes.s;
        }
    } else {
        gameState.state = gameState.panning;
    }
}

function onMouseMove(evt) {
    let ncx = 0;
    let ncy = 0;
    if (evt.touches) {
        ncx = evt.touches[0].clientX;
        ncy = evt.touches[0].clientY;
    } else {
        ncx = evt.clientX;
        ncy = evt.clientY;
    }

    let hoverSpang = findSpangleAtPoint(ncx * camera.res + camera.lEdge, ncy * camera.res + camera.tEdge);
    if (hoverSpang != -1 && !buttons[2].toggle) {
        spangles[hoverSpang].hovering = true;
    }

    if (buttons[2].toggle) {
        barPlacers.forEach(b => {
            if (checkBarAtPoint(ncx * camera.res + camera.lEdge, ncy * camera.res + camera.tEdge, b)) {
                b.hovering = true;
            }
        })
    }

    if (gameState.state == gameState.panning) {
        camera.x -= (ncx - lastMX) * camera.res;
        camera.y -= (ncy - lastMY) * camera.res;
    } else if (gameState.state == gameState.building && !buttons[2].toggle) {
        // find the closest buildable point to the mouse
        // needs to be within building length of the material
        let mpx = ncx * camera.res + camera.lEdge;
        let mpy = ncy * camera.res + camera.tEdge;

        let dist = Math.sqrt((mpx - barCursor.x1) * (mpx - barCursor.x1) + (mpy - barCursor.y1) * (mpy - barCursor.y1));

        if (dist > barCursor.type.maxLen * gridSize) { // cap the distance
            mpx = barCursor.x1 + barCursor.type.maxLen * gridSize * (mpx - barCursor.x1) / dist;
            mpy = barCursor.y1 + barCursor.type.maxLen * gridSize * (mpy - barCursor.y1) / dist;
        }

        if (mpx % gridSize > gridSize / 2) {
            mpx += gridSize;
        }
        mpx -= (mpx % gridSize);

        if (mpy % gridSize > gridSize / 2) {
            mpy += gridSize;
        }
        mpy -= (mpy % gridSize);

        barCursor.x2 = mpx;
        barCursor.y2 = mpy;
    }
    lastMX = ncx;
    lastMY = ncy;
}

function onMouseUp(evt) {
    if (gameState.state == gameState.building) {
        // place a bar if available
        let obx2 = barCursor.x2;
        let oby2 = barCursor.y2;
        if (addPossibleBar(barCursor) && barCursor.type.isSupport && buttons[3].toggle) {
            // add more supports
            for (let i = 0; i < spangles.length; i++) {
                let sp = spangles[i];
                let d = Math.sqrt(dist2(sp.x, obx2, sp.y, oby2));
                if (d <= barCursor.type.maxLen * gridSize + gridSize / 2) { // TODO : more checks
                    addPossibleBar(new BarPlacer(sp.x, sp.y, obx2, oby2, barCursor.type));
                }
            }
        }
    }

    gameState.state = gameState.default;


}

function addPossibleBar(b) {
    b.reform();
    if (verifyBar(b)) {
        barPlacers.push(new BarPlacer(b.x1, b.y1, b.x2, b.y2, b.type));
        // place spangles
        if (findSpangleAtPoint(b.x1, b.y1) == -1) {
            spangles.push(new Spangle(b.x1, b.y1));
        }
        if (findSpangleAtPoint(b.x2, b.y2) == -1) {
            spangles.push(new Spangle(b.x2, b.y2));
        }
        return true;
    }
    return false;
}

function verifyBar(b) {
    if (b.x1 == b.x2 && b.y1 == b.y2) {
        return false;
    }
    for (let i = 0; i < barPlacers.length; i++) {
        if (b.checkCollide(barPlacers[i])) {
            let b2 = barPlacers[i];
            return false;
        }
    }
    return true;
}

function verifyBarCursor() {
    return verifyBar(barCursor)
}

function redrawGrid() {
    gridCanvas.width = gridSize * barGridSpacing * gridLineInfo.gridCanvasRpt;
    gridCanvas.height = gridCanvas.width;
    gridCtx.globalAlpha = gridLineInfo.transparency;

    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.strokeStyle = gridLineInfo.colorStr;
    gridCtx.lineWidth = gridLineInfo.smWid * camera.res;
    gridCtx.beginPath();

    let gs = 0;

    for (let i = 1; i < gridLineInfo.gridCanvasRpt * barGridSpacing; i++) {
        if (i % barGridSpacing > 0) {
            gridCtx.moveTo(i * gridSize, 0);
            gridCtx.lineTo(i * gridSize, gridCanvas.height);
            gridCtx.moveTo(0, i * gridSize);
            gridCtx.lineTo(gridCanvas.width, i * gridSize);
        }
    }
    gridCtx.stroke();

    gridCtx.lineWidth = gridLineInfo.lgWid * camera.res;
    gridCtx.beginPath();

    for (let i = 0; i <= gridLineInfo.gridCanvasRpt; i++) {
        gridCtx.moveTo(i * gridSize * barGridSpacing, 0);
        gridCtx.lineTo(i * gridSize * barGridSpacing, gridCanvas.height);
        gridCtx.moveTo(0, i * gridSize * barGridSpacing);
        gridCtx.lineTo(gridCanvas.width, i * gridSize * barGridSpacing);
    }

    gridCtx.stroke();
}

function resizeBtnCanvas() {
    btnCanvas.width = canvas.offsetWidth;
    btnCanvas.height = canvas.offsetHeight;
}

function redrawBtnCanvas() {
    btnCtx.clearRect(0, 0, btnCanvas.width, btnCanvas.height);
    for (let i = 0; i < buttons.length; i++) {
        //console.log("WHY");
        buttons[i].draw(btnCtx);
    }
}

// fill grid canvas
redrawGrid();

camera.resize();
function draw() {
    // determine frame delay
    let n = getMiliTime();
    let d = n - lastTime;
    lastTime = n;
    if (d == 0) d = 1;
    frameCounter.push(1000 / d);    

    // cycle info
    for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].cooldown > 0) {
            buttons[i].cooldown--;
        }
    }

    // draw
    camera.drawScene();
}

    window.setInterval(draw, frameDelay);