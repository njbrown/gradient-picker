class Color
{
    constructor(public r:number = 0,
                public g:number = 0,
                public b:number = 0,
                public a:number = 0)
    {

    }

    public clone():Color
    {
        return new Color(this.r, this.g, this.b, this.a);
    }

    public copy(col:Color)
    {
        this.r  = col.r;
        this.g  = col.g;
        this.b  = col.b;
        this.a  = col.a;
    }

    public lerp(to:Color,t:number)
    {
        this.r = this.r * t + to.r * (1.0 - t);
        this.g = this.g * t + to.g * (1.0 - t);
        this.b = this.b * t + to.b * (1.0 - t);
        this.a = this.a * t + to.a * (1.0 - t);
    }

    public toHex():string
    {
        //https://stackoverflow.com/questions/596467/how-do-i-convert-a-float-number-to-a-whole-number-in-javascript
        var r = ~~(this.r * 255);
        var g = ~~(this.g * 255);
        var b = ~~(this.b * 255);
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    public static fromHex(hex:string):Color
    {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
        var c = new Color();
        c.r = parseInt(result[1], 16) / 255;
        c.g = parseInt(result[2], 16) / 255;
        c.b = parseInt(result[3], 16) / 255;
        return c;
        } else {
            return new Color();
        }
    }
}

class Point
{
    constructor(public x:number, public y:number)
    {

    }
}

class Box
{
    public x:number = 0;
    public y:number = 0;
    public width:number = 1;
    public height:number = 1;

    public isPointInside(px:number, py:number): boolean
    {
        if (px >= this.x && px <= this.x+this.width &&
            py >= this.y && py <= this.y+this.height)
            return true;
        return false;
    }

    public setCenter(x:number, y:number)
    {
        this.x = x - this.width/2;
        this.y = y - this.height/2;
    }

    public setCenterX(x:number)
    {
        this.x = x - this.width/2;
    }

    public setCenterY(y:number)
    {
        this.y = y - this.height/2;
    }

    public centerX():number
    {
        return this.x + this.width/2;
    }

    public centerY():number
    {
        return this.y + this.height/2;
    }

    public move(dx:number, dy:number)
    {
        this.x += dx;
        this.y += dy;
    }
}

class GradientPoint
{
    // position on gradient
    t:number;

    // color of point
    color:Color;
}

class Gradient
{
    points:GradientPoint[];

    constructor()
    {
        this.points = new Array();

        this.addPoint(0, new Color(0,0,0,1.0));
        this.addPoint(1, new Color(1,1,1,1.0));
    }

    addPoint(t:number, color:Color):GradientPoint
    {
        var point = new GradientPoint();
        point.t = t;
        point.color = color;

        this.points.push(point);
        this.sort();

        return point;
    }

    removePoint(point:GradientPoint)
    {
        this.points.splice(this.points.indexOf(point), 1);
    }

    sort()
    {
        this.points.sort(function(a:GradientPoint, b:GradientPoint) {
            return a.t - b.t;
        });
    }

    sample(t:number):Color
    {
        if (this.points.length == 0)
            return new Color();
        if (this.points.length == 1)
            return this.points[0].color.clone();

        // here at least two points are available
        if (t < this.points[0].t)
            return this.points[0].color.clone();

        var last = this.points.length - 1;
        if (t > this.points[last].t)
            return this.points[last].color.clone();

        // find two points and lerp
        for(var i = 0; i < this.points.length -1; i++) {
            if (this.points[i+1].t > t) {
                var p1 = this.points[i];
                var p2 = this.points[i+1];

                var lerpPos = (t - p1.t)/(p2.t - p1.t);
                var color = new Color();
                color.copy(p1.color);
                color.lerp(p2.color, lerpPos);

                return color;
            }
        }

        // should never get to this point
        return new Color();
    }
}

class GradientHandle
{
    xbox:Box;
    colorBox:Box = new Box();

    gradientPoint:GradientPoint;
}

export class GradientWidget
{
    canvas:HTMLCanvasElement;
    ctx:CanvasRenderingContext2D;
    gradient:Gradient;

    width:number;
    height:number;

    handles:GradientHandle[];
    lastMouseDown:Point;
    hitHandle:GradientHandle;
    // if the hitHandle is just created then this is true
    // it prevents the color picking showingup on mouse release
    // for new handles
    isNewHandle:boolean;

    handleSize:number;

    constructor(options:any)
    {
        this.width = options.any || 300;
        this.height = options.any || 50;
        this.handleSize = options.handleSize || 16;

        this.canvas = document.createElement("canvas");
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext("2d");

        this.handles = Array();
        this.lastMouseDown = new Point(0,0);
        this.isNewHandle = false;

        //this.gradient = new Gradient();
        this.setGradient(new Gradient);
        this.bindEvents();
        this.redrawCanvas();
    }

    bindEvents()
    {
        var self = this;
        this.canvas.onmousedown = function(evt:MouseEvent)
        {
            self.lastMouseDown = getMousePos(self.canvas, evt);
            self.hitHandle = self.getHitHandle(self.lastMouseDown);
            self.isNewHandle = false;

            // if no box is hit then add one and make it the drag target
            if (self.hitHandle == null && evt.button == 0) {
                var t = self.lastMouseDown.x / self.width;
                var col = self.gradient.sample(t);
                var p = self.gradient.addPoint(t, col);

                var handle = self.createGradientHandleFromPoint(p);

                self.handles.push(handle);

                // make handle draggable
                self.hitHandle = handle;
                self.isNewHandle = true;
            } else if (self.hitHandle && evt.button == 2) {
                // delete handle
                self.removeHandle(self.hitHandle);
                self.hitHandle = null;
            }

            self.redrawCanvas();
        }

        this.canvas.onmouseup = function(evt:MouseEvent)
        {
            var hitPos = getMousePos(self.canvas, evt);
            if (self.lastMouseDown.x == hitPos.x && self.lastMouseDown.y == hitPos.y && self.hitHandle && !self.isNewHandle) {
                // show color picker
                var input = document.createElement("input");
                input.type = "color";
                input.onchange = function(ev:Event)
                {
                    //console.log(ev);
                    self.hitHandle.gradientPoint.color = Color.fromHex(input.value);
                    self.redrawCanvas();
                    self.hitHandle = null;
                }
                input.click();
            } else {
                self.hitHandle = null;
                self.redrawCanvas();
            }
            
        }

        this.canvas.onmousemove = function(evt:MouseEvent)
        {
            var hitPos = getMousePos(self.canvas, evt);
            if (self.hitHandle) {
                self.hitHandle.colorBox.setCenterX(hitPos.x);
                // recalc gradient t
                var t = hitPos.x/self.width;
                self.hitHandle.gradientPoint.t = t;

                // resort handles
                self.gradient.sort();
            }

            self.redrawCanvas();
        }

        this.canvas.oncontextmenu = function(evt:PointerEvent)
        {
            evt.preventDefault();
        }

        /*
        this.canvas.onmouseleave = function(evt:MouseEvent)
        {
            // cancel dragging
            self.hitHandle = null;
            self.redrawCanvas();
        }
        */
    }

    removeHandle(handle:GradientHandle)
    {
        this.gradient.removePoint(handle.gradientPoint);
        this.handles.splice(this.handles.indexOf(handle),1);
    }

    getHitHandle(pos:Point):GradientHandle
    {
        for(let handle of this.handles) {
            if (handle.colorBox.isPointInside(pos.x, pos.y)) {
                //console.log("handle hit!");
                return handle;
            }
        }

        return null;
    }

    setGradient(grad:Gradient)
    {
        this.handles = Array();
        var handleSize = this.handleSize;

        for(let p of grad.points) {
            var handle = this.createGradientHandleFromPoint(p);
            this.handles.push(handle);
        }

        this.gradient = grad;
    }

    createGradientHandleFromPoint(p:GradientPoint):GradientHandle
    {
        var handleSize = this.handleSize;

        var handle = new GradientHandle();
        handle.gradientPoint = p;
        // eval point locations
        var box = handle.colorBox;
        box.width = handleSize;
        box.height = handleSize;
        var x = p.t * this.width;
        box.setCenterX(x);
        box.y = this.height - handleSize;

        return handle;
    }

    public el()
    {
        return this.canvas;
    }

    redrawCanvas()
    {
        var ctx = this.ctx;

        ctx.clearRect(0, 0, this.width, this.height);

        var grad = ctx.createLinearGradient(0,0,this.width, 0);
        for(let point of this.gradient.points)
        {
            grad.addColorStop(point.t, point.color.toHex());
        }

        ctx.fillStyle = grad;
        ctx.fillRect(0,0,this.width, this.height - this.handleSize);
        
        this.drawHandles();
    }

    drawHandles()
    {
        var ctx = this.ctx;
        for(let handle of this.handles)
        {
            var colBox = handle.colorBox;
            // background
            ctx.beginPath();
            ctx.fillStyle = handle.gradientPoint.color.toHex();
            ctx.rect(colBox.x, colBox.y, colBox.width, colBox.height);
            ctx.fill();

            // border
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgb(0, 0, 0)";
            ctx.rect(colBox.x, colBox.y, colBox.width, colBox.height);
            ctx.stroke();
        }
        
    }
}

// https://www.html5canvastutorials.com/advanced/html5-canvas-mouse-coordinates/
// https://stackoverflow.com/questions/17130395/real-mouse-position-in-canvas
function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
  }