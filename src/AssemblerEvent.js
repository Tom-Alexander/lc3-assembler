/**
 * @license
 *
 * LC3-Assembler
 * http://tom-alexander.github.com/lc3-assembler/
 *
 * AssemblerEvent.js
 *
 * copyright(c) 2014 Tom Alexander
 * Licensed under the MIT license.
 *
 **/

"use strict";

var AssemblerEvent = {},
    currentLineNumber = null,
    eventStack = {};

/**
 * adds a callback to the event
 * stack
 *
 * @param eventName
 * @param callback
 */
AssemblerEvent.on = function (eventName, callback) {

    if (!eventStack.hasOwnProperty(eventName)) {
        eventStack[eventName] = [];
    }

    eventStack[eventName].push(callback);
    return this;
};

/**
 * Event Emitter
 * used internally to raise assembly errors
 *
 * @param eventName
 * @param params
 */
AssemblerEvent.emit = function (eventName, params) {

    var i;

    params.push(currentLineNumber);

    if (eventStack.hasOwnProperty(eventName)) {

        for (i = 0; i < eventStack[eventName].length; i += 1) {
            eventStack[eventName][i].apply(this, params);
        }
    }

    return this;
};

/**
 * get and/or set the current line number
 *
 * @param number
 * @returns {number}
 */
AssemblerEvent.lineNumber = function (number) {

    if (number !== null) {
        currentLineNumber = number;
    }

    return currentLineNumber;

};

module.exports = AssemblerEvent;