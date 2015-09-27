var forEach = require('lodash/collection/forEach');
var filter = require('lodash/collection/filter');
var trim = require('lodash/string/trim');
var isEmpty = require('lodash/lang/isEmpty');
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
  startsWith: startsWith
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
  }

  _.forEach(parsed, function(value) {
    var name = value.substring(1, value.length);

    if (!element) {
      element = document.createElement(value);
    }
    else if (_.startsWith(value, '.')) {
      ClassList(element).add(name);
    }
    else if (_.startsWith(value, '#')) {
      element.setAttribute('id', name);
    }
  });

  return element;
}


function context () {

  var cleanupFuncs = []

  function h() {
    var args = [].slice.call(arguments);
    var element = undefined;

    function item (l) {
      var r

      if(l == null)
        ;
      else if('string' === typeof l) {
        if(!element)
          element = parseClass(l)
        else
          element.appendChild(r = document.createTextNode(l))
      }
      else if('number' === typeof l
        || 'boolean' === typeof l
        || l instanceof Date
        || l instanceof RegExp ) {
          element.appendChild(r = document.createTextNode(l.toString()))
      }
      //there might be a better way to handle this...
      else if (isArray(l))
        forEach(l, item)
      else if(isNode(l))
        element.appendChild(r = l)
      else if(l instanceof Text)
        element.appendChild(r = l)
      else if ('object' === typeof l) {
        for (var k in l) {
          if('function' === typeof l[k]) {
            if(/^on\w+/.test(k)) {
              (function (k, l) { // capture k, l in the closure
                if (element.addEventListener){
                  element.addEventListener(k.substring(2), l[k], false)
                  cleanupFuncs.push(function(){
                    element.removeEventListener(k.substring(2), l[k], false)
                  })
                }else{
                  element.attachEvent(k, l[k])
                  cleanupFuncs.push(function(){
                    element.detachEvent(k, l[k])
                  })
                }
              })(k, l)
            } else {
              // observable
              element[k] = l[k]()
              cleanupFuncs.push(l[k](function (v) {
                element[k] = v
              }))
            }
          }
          else if(k === 'style') {
            if('string' === typeof l[k]) {
              element.style.cssText = l[k]
            }else{
              for (var s in l[k]) (function(s, v) {
                if('function' === typeof v) {
                  // observable
                  element.style.setProperty(s, v())
                  cleanupFuncs.push(v(function (val) {
                    element.style.setProperty(s, val)
                  }))
                } else
                  element.style.setProperty(s, l[k][s])
              })(s, l[k][s])
            }
          } else if (k.substr(0, 5) === "data-") {
            element.setAttribute(k, l[k])
          } else {
            element[k] = l[k]
          }
        }
      } else if ('function' === typeof l) {
        //assume it's an observable!
        var v = l()
        element.appendChild(r = isNode(v) ? v : document.createTextNode(v))

        cleanupFuncs.push(l(function (v) {
          if(isNode(v) && r.parentElement)
            r.parentElement.replaceChild(v, r), r = v
          else
            r.textContent = v
        }))
      }

      return r
    }
    while(args.length)
      item(args.shift())

    return element;
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
