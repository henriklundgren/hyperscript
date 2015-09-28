var forEach = require('lodash/collection/forEach');
var filter = require('lodash/collection/filter');
var reduce = require('lodash/collection/reduce');
var trim = require('lodash/string/trim');
var first = require('lodash/array/first');
var startsWith = require('lodash/string/startsWith');

var isFunction = require('lodash/lang/isFunction');
var isEmpty = require('lodash/lang/isEmpty');
var isString = require('lodash/lang/isString');
var isNumber = require('lodash/lang/isNumber');
var isBoolean = require('lodash/lang/isBoolean');
var isObject = require('lodash/lang/isObject');
var isPlainObject = require('lodash/lang/isPlainObject');
var isDate = require('lodash/lang/isDate');
var isRegExp = require('lodash/lang/isRegExp');
var isArray = require('lodash/lang/isArray');
var isUndefined = require('lodash/lang/isUndefined');

var split = require('browser-split')
var classList = require('class-list')
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
  isString: isString,
  isArray: isArray,
  isNumber: isNumber,
  isDate: isDate,
  isRegExp: isRegExp,
  isBoolean: isBoolean,
  isObject: isObject,
  isFunction: isFunction,
  isPlainObject: isPlainObject
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

  function mapper(value) {
    if (_.isUndefined(element)) {
      element = document.createElement(value);
      return element;
    }
    return value;
  }

  function reducer(prev, next) {
    var element = prev;
    var value = next;
    var name = value.substring(1, value.length);

    if (_.startsWith(value, '.')) {
      classList(element).add(name);
    }
    else if (_.startsWith(value, '#')) {
      element.setAttribute('id', name);
    }
    return element;
  }

  return parsed.map(mapper).reduce(reducer);
}


function context () {

  var cleanupFuncs = []

  function h() {
    var args = ([].slice.call(arguments)).map(function(x) {
      return _.isString(x) ? _.trim(x) : x;
    });

    var element = undefined;

    function createElement(argument) {
      if (_.isString(argument) && _.isUndefined(element)) {
        element = parseClass(argument);
        return element;
      }
      return argument;
    }

    function reducer(prev, next) {
      var element = prev;
      var node = undefined;

      if (_.isString(next)) {
        var textNode = node = document.createTextNode(next);
        element.appendChild(textNode);
      }

      else if (_.isNumber(next)
        || _.isBoolean(next)
        || _.isDate(next)
        || _.isRegExp(next)) {
        var textNode = node = document.createTextNode(String(next));
        element.appendChild(textNode);
      }

      else if (_.isArray(next)) {
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

      else if (_.isPlainObject(next)) {

        _.forEach(next, function eachObject(value, key) {
          if (_.isFunction(value)) {
            if (/^on\w+/.test(key)) {

              // capture k, l in the closure
              (function IIFE(key, value) {
                if (element.addEventListener) {
                  element.addEventListener(key.substring(2), value, false);

                  cleanupFuncs.push(function() {
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
              }(key, value));
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
            if (_.isString(value)) {
              element.style.cssText = value;
            }
            else {
              _.forEach(value, function(propValue, propKey) {
                (function(key, value) {
                  if (_.isFunction(value)) {
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
            if (element.dataset) {
              var name = key.substr(5, key.length);
              return element.dataset[name] = value;
            }
            element.setAttribute(key, value);
          }
          else {
            element[key] = value;
          }
        });

      }

      else if (_.isFunction(next)) {
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
    }

    return args.map(createElement).reduce(reducer);
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

/*function isArray (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]'
}*/

