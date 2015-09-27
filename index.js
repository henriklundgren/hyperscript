var forEach = require('lodash/collection/forEach');
var filter = require('lodash/collection/filter');
var reduce = require('lodash/collection/reduce');
var trim = require('lodash/string/trim');
var isEmpty = require('lodash/lang/isEmpty');
var isString = require('lodash/lang/isString');
var isUndefined = require('lodash/lang/isUndefined');
var first = require('lodash/array/first');
var startsWith = require('lodash/string/startsWith');

var split = require('browser-split')
var ClassList = require('class-list')
require('html-element')

var _ = {
  forEach: forEach,
  filter: filter,
  trim: trim,
  isEmpty: isEmpty,
  first: first,
  startsWith: startsWith,
  isUndefined: isUndefined,
  reduce: reduce,
  isString: isString
};

function parseClass(string) {
  'use strict';
  var element = undefined;

  // Our minimal parser doesn’t understand escaping CSS special
  // characters like `#`. Don’t use them. More reading:
  // https://mathiasbynens.be/notes/css-escapes .

  var parsed = _.filter(split(_.trim(string), /([\.#]?[^\s#.]+)/), function(v) {
    return !_.isEmpty(v);
  });

  if (/^\.|#/.test(_.first(parsed))) {
    element = document.createElement('div');
    parsed.unshift(element);
  }

  return parsed
    .map(function(value) {
      if (_.isUndefined(element)) {
        element = document.createElement(value);
        return element;
      }
      return value;
    })
    .reduce(function(prev, next) {
      var element = prev;
      var value = next;
      var name = value.substring(1, value.length);

      if (_.startsWith(value, '.')) {
        ClassList(element).add(name);
      }
      else if (_.startsWith(value, '#')) {
        element.setAttribute('id', name);
      }

      return element;
    });
}


function context () {

  var cleanupFuncs = []

  function h() {
    var args = ([].slice.call(arguments)).map(function(x) {
      return _.isString(x) ? _.trim(x) : x;
    });

    var element = undefined;

    return args.map(function createElement(argument) {
      if (_.isString(argument) && _.isUndefined(element)) {
        element = parseClass(argument);
        return element;
      }
      return argument;

    }).reduce(function reducer(prev, next) {
      var element = prev;
      var node = undefined;

      if (_.isString(next)) {
        var textNode = node = document.createTextNode(next);
        element.appendChild(textNode);
      }

      else if ('number' === typeof next
        || 'boolean' === typeof next
        || next instanceof Date
        || next instanceof RegExp ) {
        var textNode = node = document.createTextNode(String(next));
        element.appendChild(textNode);
      }

      else if (isArray(next)) {
        _.forEach(next, function(v) {
          element.appendChild(v);
        });
      }

      else if (isNode(next)) {
        node = next;
        element.appendChild(next);
      }
      else if (next instanceof Text) {
        node = next;
        element.appendChild(next)
      }

      else if ('object' === typeof next) {

        _.forEach(next, function(value, key) {
          if ('function' === typeof value) {
            if (/^on\w+/.test(key)) {

              // capture k, l in the closure
              (function (key, value) {
                if (element.addEventListener) {
                  element.addEventListener(key.substring(2), value, false);

                  cleanupFuncs.push(function(){
                    element.removeEventListener(key.substring(2), value, false);
                  });
                }
                // ie<=8
                else {
                  element.attachEvent(key, value);

                  cleanupFuncs.push(function() {
                    element.detachEvent(key, value);
                  });
                }
              })(key, value);
            }
            else {
              // observable
              element[key] = value();

              cleanupFuncs.push(value(function(v) {
                element[key] = v;
              }));
            }
          }

          else if (key === 'style') {
            if ('string' === typeof value) {
              element.style.cssText = value;
            }
            else {
              console.log('set style', value);
              _.forEach(value, function(propValue, propKey) {
                (function(key, value) {
                  if('function' === typeof value) {
                    // observable
                    element.style.setProperty(key, value());

                    cleanupFuncs.push(value(function(val) {
                      element.style.setProperty(key, val)
                    }));
                  }
                  else {
                    element.style.setProperty(key, value);
                  }
                }(propKey, propValue));
              });
            }
          }

          else if (key.substr(0, 5) === 'data-') {
            element.setAttribute(key, value);
          }
          else {
            element[key] = value;
          }
        });

      }

      else if ('function' === typeof next) {
        //assume it's an observable!
        var value = next()
        var nodeValue = isNode(value) ? value : document.createTextNode(value);
        node = nodeValue;
        element.appendChild(nodeValue);

        cleanupFuncs.push(next(function(v) {
          if (isNode(v) && node.parentElement) {
            node.parentElement.replaceChild(v, node);
            node = v;
          }
          else {
            node.textContent = v;
          }
        }));
      }

      return element;
    });
  }

  h.cleanup = function () {
    for (var i = 0; i < cleanupFuncs.length; i++){
      cleanupFuncs[i]()
    }
    cleanupFuncs.length = 0
  }

  return h
}

var h = module.exports = context()
h.context = context

function isNode (el) {
  return el && el.nodeName && el.nodeType
}

function isText (el) {
  return el && el.nodeName === '#text' && el.nodeType == 3
}

/*function forEach (arr, fn) {
  if (arr.forEach) return arr.forEach(fn)
  for (var i = 0; i < arr.length; i++) fn(arr[i], i)
}*/

function isArray (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]'
}
