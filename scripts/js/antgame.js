//<![CDATA[

// All this code is bad. It is a prototype and meant implement a proof on of concept.
// Code revision will occur after each milestone.

var widthElem = document.getElementById('canvasWidth');
var heightElem = document.getElementById('canvasHeight');
var pixelCountDisplay =  document.getElementById('canvasPixelCount');
var canvas = document.getElementById('gameworld');
var context = canvas.getContext('2d');
var canvasWidth  = canvas.width;
var canvasHeight = canvas.height;
var ctx = canvas.getContext('2d');
var imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
	
var buf = new ArrayBuffer(imageData.data.length);	// a liniar arraybuffer that stores the color data for the image.
var buf8 = new Uint8ClampedArray(buf); 				// used to index into the bufer via 8bit ord
var data = new Uint32Array(buf);					// used to index into the buffer via a 32 bit ord


var theWorld = null;
var numLayers = 2; // temporary to implement depth buffer



function render() {

	pushToCanvas();
}

function canvasSize(width,height) {

	console.log("setting canvas w:"+width+" h:"+height);

console.group("Creating Map");
console.timeStamp("Creating Map");
console.time("Creating Map");

	theWorld = new Map(width,height,numLayers);

console.timeStamp("Creating Map");
console.timeEnd("Creating Map");
console.groupEnd(); // "Creating Map"
	
	// ajust canvas sizes
	canvas.width=width;
	canvas.height=height;
	canvas.style.width  = width+'px';
	canvas.style.height = height+'px';
	
	// ajust buffers 	
	canvasWidth  = canvas.width;
	canvasHeight = canvas.height;
	imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
	
	buf = new ArrayBuffer(imageData.data.length);
	buf8 = new Uint8ClampedArray(buf);
	data = new Uint32Array(buf);
	pixelGen();

	//display it
	widthElem.textContent	=	canvas.width;
	heightElem.textContent	=	canvas.height;
	pixelCountDisplay.textContent	=	canvas.width*canvas.height;
	
	render();
}

// Determine whether Uint32 is little- or big-endian.
data[1] = 0x0a0b0c0d;
	
function endiannessCheck() {
	var isLittleEndian = true;
	if (buf[4] === 0x0a && buf[5] === 0x0b && buf[6] === 0x0c &&
		buf[7] === 0x0d) {
		isLittleEndian = false;
	}
	return isLittleEndian;
}

var pixelGen = function () {
	// highspeed rendering method based on 
	// https://hacks.mozilla.org/2011/12/faster-canvas-pixel-manipulation-with-typed-arrays/
	console.log("choosing endianness");
	// first time in this function, we decide what call to really run
	if (endiannessCheck()) {
		console.log("setting to little endian");
		pixelGen = lePixelGen;
	} else {
		console.lgo("setting to beg endian");
		pixelGen = bePixelGen;
	}
	
	// now we call the real function
	pixelGen();
};

function lePixelGen() {
	//console.log("Generate (little endianness)");
	for (var y = 0; y < canvasHeight; ++y) {
		for (var x = 0; x < canvasWidth; ++x) {
			var value = x * y & 0xff;
			
			data[y * canvasWidth + x] = random.uint32()
			
			/*
				(255   << 24) |    // alpha
				(value << 16) |    // blue
				(value <<  8) |    // green
				 value;            // red
			*/
		}
	}
	
}

function bePixelGen() {
	//console.log("Generate (big endianness)");
	for (y = 0; y < canvasHeight; ++y) {
		for (x = 0; x < canvasWidth; ++x) {
			value = x * y & 0xff;

			data[y * canvasWidth + x] = random.uint32()
			
			/*
				(value << 24) |    // red
				(value << 16) |    // green
				(value <<  8) |    // blue
				 255;              // alpha
			*/
		}
	}
}

function pushToCanvas() {
	//console.log("Drawing");
	imageData.data.set(buf8);
	ctx.putImageData(imageData, 0, 0);
}

function tick() {
	pixelGen();
}

function reroll() {
	pixelGen();
	pushToCanvas();
}

var start = false;
var running = false;
var frameCount = 0;
var tickCount = 0;

function gameStart() {
	start = true;
	
	if(!running) {
		console.group("Game Running");
		console.timeStamp("Game Running");
		console.time("Game Running");
	
		gameLoop(0);
	}
}

function gameStop() {
	
	start = false;
	if(running) {
		console.timeStamp("Game Stoppped");
		console.timeEnd("Game Running");
		console.groupEnd(); // "Game Running"
	}
}

var simSpeed = 60;
var tickAccum = 0;
function setSimSpeed(speed) {
	simSpeed = speed;
	
	
}



var tickDisplay = document.getElementById('tickDisplay');
var frameDisplay = document.getElementById('frameDisplay');
var framerateDisplay = document.getElementById('framerateDisplay');
var frametimeDisplay = document.getElementById('frametimeDisplay');
var tickrateDisplay = document.getElementById('tickrateDisplay');
var ticktimeDisplay = document.getElementById('ticktimeDisplay');
var frametickDisplay = document.getElementById('frametickDisplay');

// fps calc from https://stackoverflow.com/questions/5078913/html5-canvas-performance-calculating-loops-frames-per-second
var fps = 0;
var frameTime=0;
var now;
var lastFrameUpdate = (new Date) *1 - 1;
var lastTickUpdate = (new Date) *1 - 1;
// The higher this value, the less the FPS will be affected by quick changes
// Setting this to 1 will show you the FPS of the last sampled frame only
var fpsFilter = 5;
var fpsUpdateInterval = 1000; // how often to update the displays, in ms

var tps = 0;
var tickTime = 0;
var tpsFilter = 5;
var tpsUpdateInterval = 1000;

function gameLoop(time) {
	now = new Date();
	
	render();
	
	frameCount++;
	frameTime = (now - lastFrameUpdate);
	lastFrameUpdate = now * 1 - 1;
	
	
	/*
		psudo code for elapsed time vs frames - fixing timestep
		time elapsed += frame time
		while timeelapsed > timepertick, tick() && timeelapsed-=timepertick
	*/
	
	tickAccum++;
	if(tickAccum >= (60-simSpeed)) {
		tickCount++;
		tickTime = (now - lastTickUpdate);
		lastTickUpdate = now * 1 - 1;
		tickAccum =0;
		tick();
	}
	
	
	
	
	
	//need to store last frame times sepearately from last tick times
	
	var thisFrameFPS = 1000 / frameTime;
	fps += (thisFrameFPS - fps) / fpsFilter;
	
	var thisTickTPS = 1000 / tickTime;
	tps += (thisTickTPS - tps) / tpsFilter;
	
	

	if(start){
		running = true;
		window.requestAnimationFrame(gameLoop);
	}
	else {
		running = false;
		// game is not running
	}
	
	console.timeEnd("gameLoop()");
}

//this periodically updates the displays
// should be rewritten to store in a timer management system so that I can set and clear it easier
setInterval(function(){
frameDisplay.innerHTML = frameCount;
	framerateDisplay.innerHTML = fps.toFixed(2) + "fps";
	if(running) console.log("fps: "+fps.toFixed(2)+"\tframes: "+frameCount);
	frametickDisplay.innerHTML = simSpeed;
}, fpsUpdateInterval);
setInterval(function(){
	frameDisplay.innerHTML = frameCount;
}, fpsUpdateInterval/10);
	setInterval(function(){
	frametimeDisplay.innerHTML = frameTime;
}, fpsUpdateInterval/10);

setInterval(function(){
tickDisplay.innerHTML = frameCount;
	tickrateDisplay.innerHTML = tps.toFixed(2) + "tps";
	if(running) console.log("fps: "+tps.toFixed(2)+"\tticks: "+tickCount);
}, tpsUpdateInterval);
setInterval(function(){
	tickDisplay.innerHTML = tickCount;
}, tpsUpdateInterval/10);
	setInterval(function(){
	ticktimeDisplay.innerHTML = tickTime;
}, tpsUpdateInterval/10);
	


console.group("Game Setup");
console.timeStamp("Game Setup");
console.time("Game Setup");


canvasSize(2,2);
pixelGen();

console.timeStamp("Game Setup Ended");
console.timeEnd("Game Setup");
console.groupEnd(); // "Game Setup"
//]]>

