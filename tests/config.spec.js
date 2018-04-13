var config = require('../config')
var assert = require('assert')

var isSorted = function(array) { return Boolean(array.reduce((memo, item) => memo && item >= memo && item)) }

assert(isSorted(config.lists.map(list => list.id)), 'Mailing lists should be sorted by id.')
