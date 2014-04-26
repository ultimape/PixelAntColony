/* cell-color.js
 * A bunch of lookup table defining what color should be displayed for various elements.
 */


var colorTable = {
	terrain : {
		dirt		: 'brown',
		mud			: 'dark-brown',
		empty		: 'tan',
		water		: 'light-blue',
	},
	material : {
		plant		: 'green',
		pulp		: 'dark-green',
		fungus		: 'orange',
		refuse		: 'purple',
		dead-ant	: 'yellow',
		loose-dirt	: 'light-brown',
	},
	creature : {
		queen		: 'black',
		egg			: 'white',
		larva		: 'white',
		pupa		: 'white',
		young-ant	: 'light-gray',
		ant			: 'gray',
		old-ant		: 'dark-gray',
	},
	scent : {
		ant : {
			hive	: 'purple',
			forage	: 'blue',
			food	: 'white',
			alarm	: 'red',
		},
		enviroment	: {
			water	: 'blue',
			plant	: 'green',
			refuse	: 'purple',
			dirt	: 'brown',
		}
	}
}



// Convert a named color to its hex codes.
// We have to break the colors down to it's parts because the byte stream
// that we write into for the canvas may not have the same endianness
// (This means, we have to input the bytes in different orders, so we 
// can't assume that it is FF0000, since it may be expecting 0000FF)
var hexColorsByName = {
	
	/* first, the ms-dos console colors, because sexyness */
	black 			= {r : 0x00, g : 0x00, b : 0x00},
	blue 			= {r : 0x00, g : 0x00, b : 0xEE},
	green 			= {r : 0x00, g : 0xCD, b : 0x00},
	aqua 			= {r : 0x00, g : 0xCD, b : 0xCD},
	red				= {r : 0xCD, g : 0x00, b : 0x00}
	purple			= {r : 0xCD, g : 0x00, b : 0xCD},
	yellow			= {r : 0xCD, g : 0xCD, b : 0x00},
	white			= {r : 0xE5, g : 0xE5, b : 0xE5},
	gray			= {r : 0x7F, g : 0x7F, b : 0x7F},
	grey			= {r : 0x7F, g : 0x7F, b : 0x7F}, // because english
	light-blue		= {r : 0x5C, g : 0x5C, b : 0xFF},
	light-green		= {r : 0x00, g : 0xFF, b : 0x00},
	light-aqua		= {r : 0x00, g : 0xFF, b : 0xFF},
	light-red		= {r : 0xFF, g : 0x00, b : 0x00},
	light-purple	= {r : 0xFF, g : 0x00, b : 0xFF},
	light-yellow	= {r : 0xFF, g : 0xFF, b : 0x00},
	bright-white	= {r : 0xFF, g : 0xFF, b : 0xFF},
	
	/* other colors */
	dark-gray		= {r : 0x44, g: 0x44, b : 0x44},
	light-gray		= {r : 0x9E, g: 0x9E, b : 0x9E},
	tan				= {r : 0xB9, g: 0x7A, b : 0x57},
	light-brown		= {r : 0x91, g: 0x71, b : 0x5F},
	brown			= {r : 0x84, g: 0x52, b : 0x37},
	dark-brown		= {r : 0x60, g: 0x3C, b : 0x28},
	orange			= {r : 0xFF, g: 0xAF, b : 0x00},
	dark-green		= {r : 0x00, g: 0x5F, b : 0x00}, 
	
}
	
// MS-DOS console uses a special set of codes for it's colors
// This allows for translation between them.
// Why? Because console.
var WinColorCodeConv = {
	'0' : 'black',
	'1' : 'blue',
	'2' : 'green',
	'3' : 'aqua',
	'4' : 'red',
	'5' : 'purple',
	'6' : 'yellow',
	'7' : 'white',
	'8' : 'gray',
	'9' : 'light-blue',
	'A' : 'light-green',
	'B' : 'light-aqua',
	'C' : 'light-red',
	'D' : 'light-purple',
	'E' : 'light-yellow',
	'F' : 'bright-white',
}