/* cell-id.js
 * A lookup table to define the IDs of various cell types used when storing cell data
 * This lets me specify IDs by name, so if I add more into the game, I don't need to rejigger the numbers.
 * It is more effecient to store the tiles as integers
 */

var cellList = [
	'empty'			/*: 0 */,
	'dirt'			/*: 1 */,
	'water'			/*: 2 */,
	'mud'			/*: 3 */,
	'plant'			/*: 4 */,
	'pulp'			/*: 5 */,
	'fungus'		/*: 6 */,
	'refuse'		/*: 7 */,
	'ant-dead'		/*: 8 */,
	'dirt-loose'	/*: 9 */,
	'queen'			/*: 10*/,
	'egg'			/*: 11*/,
	'larva'			/*: 12*/,
	'pupa'			/*: 13*/,
	'ant-young'		/*: 14*/,
	'ant'			/*: 15*/,
	'ant-old'		/*: 16*/,
	'hive-scent'	/*: 17*/,
	'forage-scent'	/*: 18*/,
	'food-scent'	/*: 19*/,
	'alarm-scent'	/*: 20*/,
	'water-scent'	/*: 21*/,
	'plant-scent'	/*: 22*/,
	'refuse-scent'	/*: 23*/,
	'dirt-scent'	/*: 24*/,
]

var idTable = new Array();
numberizeCells();

function numberizeCells() {
	for( cell in cellList ) {
		console.log("cell : ( "+cellList[cell]+" = "+cell+" )");
		idTable[cellList[cell]]=cell;
	}
	
	
	for( id in idTable ) {
		console.log("id "+id+" is "+idTable[id]);
		idTable[cellList[cell]]=cell;
	}
	
}