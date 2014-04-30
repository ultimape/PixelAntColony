
/*//a reminder to myself that I ought to be using point datatypes
function Point(x,y) {
	this._x = x;
	this._y = y;
}
Point.prototype.getX = function() {
	return this._x;
}
Point.prototype.getY = function() {
	return this._y;
}
*/


function Map( width, height, numLayers ) {
	
	this.width = width;
	this.height = height;
	this.numLayers = numLayers;
	this.layer = new Array();
	
	console.log("Creating Map: w:"+width+" h:"+height+" layers:"+numLayers);
	
	this.compositLayer = new Layer(this.width, this.height);
	this.compositLayer.clearLayer();
	
	for(var i = 0; i < numLayers; i++) {
		this.layer.push(new Layer(this.width,this.height));
		this.layer[i].randomizeTest();
		console.log("Layer: " + i );
		console.log(this.layer[i]);
	}
	
	//console.log("attempting to compact");
	//var compositLayerString = this.compositLayer.toString();
	//console.log(compositLayerString);
	this.compact();
	//var compositLayerString2 = this.compositLayer.toString();
	//console.log(compositLayerString2);

}

// Takes all the layers and compacts the data into the composit layer
Map.prototype.compact = function() {
	
	/*(
for each layer,
from the bottom up,
look to see if there is something there. 
If it is a 0, skip, otherwise, put the value in the return array.
	*/
	
	var valueAtPosition = 0;
	
	// for ever position in the map
	for(var position = 0; position < this.width*this.height; position++){
		// for each layer
		for(var layerid = 0; layerid < numLayers; layerid++ ) {
			
			// get the value stored in the position
			valueAtPosition = this.layer[layerid].getDataAtIndex(position);
			
			//console.log("layer: "+ layerid +" index: "+ position +" valuebuffer: "+valueAtPosition );
			
			// if the value is not a 0, composit it to the compacted version
			if(valueAtPosition != 0) {
				
				this.compositLayer.setDataAtIndex(position,valueAtPosition);
			}
		}
	}
}


function Layer(width,height) {
	this.width = width;
	this.height = height;
	
	//each datapoint is a 0-255 valued integer, representing the element at that position.
	
	this.data = new Uint8ClampedArray(width*height);
	
}

Layer.prototype.getNeighbors = function() {
	
}
Layer.prototype.getData = function() {
	return data;
}

Layer.prototype._CoordToIndex = function(x,y) {
	return y * this.width + x;
}


/* helper functions for getting access to the data */
Layer.prototype.getDataAtCoord = function(x,y) {
	var index = this._CoordToIndex(x,y);
	return this.getDataAtIndex(index);
}
Layer.prototype.getDataAtIndex = function(index) {
	return this.data[index];
}

/* helper functions for setting the layer's data */
Layer.prototype.setDataAtCoord = function(x,y,dataval) {
	var index = this._CoordToIndex(x,y);
	this.setDataAtIndex(index,dataval);
}
Layer.prototype.setDataAtIndex = function(index,dataval) {
	this.data[index] = dataval & 0xf;
}

Layer.prototype.toString = function() {
	var stringifiedArray = "";
	
	for (var y = 0; y < this.height; ++y) {
		for (var x = 0; x < this.width; ++x) {
			stringifiedArray += this.getDataAtCoord(x,y);
			stringifiedArray += ",";
		}
		stringifiedArray += "\n";
	}
	
	return stringifiedArray;
}

Layer.prototype.randomizeTest = function () {
	for (var y = 0; y < this.height; ++y) {
		for (var x = 0; x < this.width; ++x) {
			this.setDataAtCoord(x,y,random.uint32() & 0xf);
		}
	}
	console.log("randomized layer");
}

Layer.prototype.clearLayer = function () {
	for (var y = 0; y < this.height; ++y) {
		for (var x = 0; x < this.width; ++x) {
			this.data[y * this.width + x] = 0 & 0xf;
		}
	}
	console.log("cleared layer");
}
