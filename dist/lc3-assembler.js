(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
/**
 * @license
 *
 * LC3-Assembler
 * http://tom-alexander.github.com/lc3-assembler/
 *
 * Assembler.js
 *
 * copyright(c) 2014 Tom Alexander
 * Licensed under the MIT license.
 *
 **/

"use strict";

var Parse = require('./Parse'),
    AssemblerEvent = require('./AssemblerEvent'),
    Assembler;

Assembler = function () {
    this.events = {};
    this.on = AssemblerEvent.on;
    return this;
};

/**
 * convert the assembly code to
 * object code
 *
 * @param source
 * @returns {Array}
 */
Assembler.prototype.run = function (source) {

    var address,
        operation,
        counter = 0,
        symbolTable = [],
        machineCode = [],
        parsedInstruction,
        currentInstruction,
        didFindEnd = false,
        code = source.replace(/(^[ \t]*\n)/gm, '').trim().split('\n');

    // FIRST PASS
    for (address = 0; address < code.length; address += 1) {

        currentInstruction = Parse.line(code[address]);

        if (currentInstruction[0]) {

            if (currentInstruction[0] === '.END') {
                didFindEnd = true;
                break;
            }

            if (!Parse.instruction.hasOwnProperty(currentInstruction[0].replace('.', '').toUpperCase() )) {
                if (currentInstruction[0].indexOf('BR') < 0 ) {
                    symbolTable[currentInstruction[0]] = counter;
                    currentInstruction.shift();
                }
            }

            operation = currentInstruction[0].indexOf('BR') >= 0 ? 'BR' : currentInstruction[0];

            operation = operation.indexOf('.') >= 0 ? operation.replace('.', '') : operation;
            operation = operation.toUpperCase();

            if (Parse.instruction.hasOwnProperty(operation)) {

                currentInstruction = Parse.instruction[operation](currentInstruction);

                if (typeof currentInstruction.instruction === 'string' || currentInstruction.instruction instanceof String) {
                    machineCode.push(currentInstruction);
                    counter += 1;
                }

                if (Object.prototype.toString.call(currentInstruction) === '[object Array]') {
                    machineCode = machineCode.concat(currentInstruction);
                    counter += currentInstruction.length;
                }

            }
        }
    }

    if (!didFindEnd) {
        AssemblerEvent.emit('error', ['Expected .END at end of file']);
    }

    // SECOND PASS
    for (address = 0; address < machineCode.length; address += 1) {

        if (machineCode[address].hasOwnProperty('labelOffset')) {

            parsedInstruction = Parse.label(
                machineCode[address].instruction,
                machineCode[address].labelOffset,
                symbolTable,
                address
            );

            if (parsedInstruction === machineCode[address].instruction) {
                AssemblerEvent.emit('error', ['instruction references an undefined label.']);
            }

            machineCode[address] = parsedInstruction;

        } else {
            machineCode[address] = machineCode[address].instruction;
        }

    }

    this.machineCode = machineCode;
    return this;
};

module.exports = Assembler;
global.window.Assembler = Assembler;
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./AssemblerEvent":2,"./Parse":3}],2:[function(require,module,exports){
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

    if (eventStack.hasOwnProperty(eventName)) {

        for (i = 0; i < eventStack[eventName].length; i += 1) {
            eventStack[eventName][i].apply(this, params);
        }
    }

    return this;
};

module.exports = AssemblerEvent;
},{}],3:[function(require,module,exports){
/**
 * @license
 *
 * LC3-Assembler
 * http://tom-alexander.github.com/lc3-assembler/
 *
 * Parse.js
 *
 * copyright(c) 2014 Tom Alexander
 * Licensed under the MIT license.
 *
 *
 **/

"use strict";

var AssemblerEvent = require('./AssemblerEvent'),
    parameterMismatch,
    Parse = {};

Parse.instruction = {};

/**
 * AND operation
 * 0001 DR SR1 0 00 SR2
 * 0001 DR SR1 1 imm5
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.ADD = function (instruction) {

    parameterMismatch(instruction.length, 4);

    var DR  =   Parse.registers(instruction[1]),
        SR1 =   Parse.registers(instruction[2]),
        SR2 =   Parse.registers(instruction[3]),
        imm5 =  Parse.number(instruction[3], 5);

    SR2 = imm5 ? '1' + imm5 : '000' + SR2;
    return {instruction: '0001' + DR + SR1 + SR2};
};

/**
 * AND operation
 * 0101 DR SR1 0 00 SR2
 * 0101 DR SR1 1 imm5
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.AND = function (instruction) {

    parameterMismatch(instruction.length, 4);

    var DR  =   Parse.registers(instruction[1]),
        SR1 =   Parse.registers(instruction[2]),
        SR2 =   Parse.registers(instruction[3]),
        imm5 =  Parse.number(instruction[3], 5);

    SR2 = imm5 ? '1' + imm5 : '000' + SR2;
    return {instruction: '0101' + DR + SR1 + SR2};
};

/**
 * BR operation
 * 0000 n z p PCoffset9
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.BR = function (instruction) {

    parameterMismatch(instruction.length, 2);

    var condition = [0, 0, 0],
        PCOffset9 = instruction[1];

    condition[0] = instruction[0].indexOf('n') >= 0 ? 1 : 0;
    condition[1] = instruction[0].indexOf('z') >= 0 ? 1 : 0;
    condition[2] = instruction[0].indexOf('p') >= 0 ? 1 : 0;

    return {instruction: '0000' + condition.join('') + PCOffset9, labelOffset: 9};
};

/**
 * JMP operation
 * 1100 000 BaseR 000000
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.JMP = function (instruction) {

    parameterMismatch(instruction.length, 2);

    var baseR = Parse.registers(instruction[1]);
    return {instruction : '1100000' + baseR + '000000'};
};

/**
 * JSR
 * 0100 1 PCOffset11
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.JSR = function (instruction) {
    return {instruction: '01001' + instruction[1], labelOffset: 11};
};

/**
 * JSRR
 * 0100 0 00 BaseR 000000
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.JSRR = function (instruction) {
    var baseR = Parse.registers(instruction[1]);
    return {instruction: '0100000' + baseR + '000000'};
};

/**
 * LD operation
 * 0010 DR PCOffset9
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.LD = function (instruction) {
    var DR = Parse.registers(instruction[1]),
        PCOffset9 = Parse.number(instruction[2], 9);

    return {instruction: '0010' + DR + PCOffset9, labelOffset: 9};
};

/**
 * LDI operation
 * 1010 DR PCOffset9
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.LDI = function (instruction) {
    var DR = Parse.registers(instruction[1]),
        PCOffset9 = Parse.number(instruction[2], 9);

    return {instruction: '1010' + DR + PCOffset9, labelOffset: 9};
};

/**
 * LDR operation
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.LDR = function (instruction) {
    var DR  = Parse.registers(instruction[1]),
        baseR = Parse.registers(instruction[2]),
        offset6 = Parse.number(instruction[3], 6);

    return {instruction: '0110' + DR + baseR + offset6, labelOffset: 6};
};

/**
 * LEA operation
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.LEA = function (instruction) {
    var DR = Parse.registers(instruction[1]),
        PCOffset9 = instruction[2];

    return {instruction: '1110' + DR + PCOffset9, labelOffset: 9};
};

/**
 * NOT operation
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.NOT = function (instruction) {

    parameterMismatch(instruction.length, 3);

    var DR  = Parse.registers(instruction[1]),
        SR = Parse.registers(instruction[2]);

    return {instruction: '1001' + DR + SR + '111111'};
};

/**
 * RET operation
 *
 * @returns {}
 */
Parse.instruction.RET = function () {
    return {instruction: '1100000111000000'};
};

/**
 * RTI operation
 *
 * @returns {}
 */
Parse.instruction.RTI = function () {
    return {instruction: '1000000000000000'};
};

/**
 * ST operation
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.ST = function (instruction) {

    parameterMismatch(instruction.length, 3);

    var SR = Parse.registers(instruction[1]),
        PCOffset9 = instruction[2];

    return {instruction: '0011' + SR + PCOffset9, labelOffset: 9};
};

/**
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.STI = function (instruction) {

    parameterMismatch(instruction.length, 3);

    var SR = Parse.registers(instruction[1]),
        PCOffset9 = instruction[2];

    return {instruction: '1011' + SR + PCOffset9, labelOffset: 9};
};

/**
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.STR = function (instruction) {

    parameterMismatch(instruction.length, 3);

    var DR  = Parse.registers(instruction[1]),
        baseR = Parse.registers(instruction[2]),
        offset6 = Parse.number(instruction[3], 6);

    return {instruction: '0111' + DR + baseR + offset6, labelOffset: 6};
};

/**
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.TRAP = function (instruction) {
    parameterMismatch(instruction.length, 2);
    var trapVector8 = Parse.number(instruction[1], 8);
    return {instruction: '11110000' + trapVector8};
};

/**
 * PSEUDO OPERATIONS
 * TRAP SUB ROUTINES
 */

/**
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.ORIG = function (instruction) {
    return {instruction: Parse.number('0d' + instruction[1], 16)};
};

/**
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.FILL = function (instruction) {
    return {instruction: Parse.number('0d' + instruction[1], 16)};
};

/**
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.BLKW = function (instruction) {
    var instructions = [],
        i;

    for (i = 0; i < instruction[1]; i += 1) {
        instructions.push({instruction: Parse.number('0d0', 16)});
    }

    instructions.push({instruction: Parse.number('0d0', 16)});
    return instructions;
};

/**
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction.STRINGZ = function (instruction) {
    var i,
        instructions = [],
        value = instruction[1].replace(/["]/g, '');

    for (i = 0; i < value.length; i += 1) {
        instructions.push({instruction: Parse.number('0d' + value.charCodeAt(i), 16)});
    }

    instructions.push({instruction: Parse.number('0d0', 16)});
    return instructions;
};

/**
 * TRAP routines
 *
 * @returns {}
 */
Parse.instruction.GETC = function () {
    return {instruction: '11110000' + '00100000'};
};

Parse.instruction.OUT = function () {
    return {instruction: '11110000' + '00100001'};
};

Parse.instruction.PUTS = function () {
    return {instruction: '11110000' + '00100010'};
};

Parse.instruction.HALT = function () {
    return {instruction: '11110000' + '00100011'};
};

/**
 * remove comments from a line of source code
 * and creates an array of operations and operands
 *
 * @param line
 * @returns {Array}
 */
Parse.line = function (line) {

    line = line.replace(/\s*(,|^|$)\s*/g, "$1");

    if (line.indexOf(';') >= 0) {
        line = line.substring(0, line.indexOf(';')).trim();
    }

    line = line.replace(/[ ]/g, ',').trim();

    return line.split(',');
};

/**
 * creates a 3 bit binary string
 * based on the register number
 *
 * @param register
 * @returns {String}
 */
Parse.registers = function (register) {
    return register.indexOf('R') >= 0 || register.indexOf('r') >= 0 ? this.number('0d' + register.substring(1, 2), 3) : '';
};

Parse.number = function (string, space) {

    var typed, value, isNegative;

    if (string.substring(0, 1) === '#' || string.substring(0, 1) === 'x') {
        string = string.replace('#', '0d').replace('x', '0x');
    }

    typed = string.substring(0, 2) === '0x' || string.substring(0, 2) === '0d';
    string = string.replace('0d', '');

    if (typed) {

        isNegative = parseInt(string) < 0;
        value = (parseInt(string) >>> 0).toString(2);

        if (parseInt(string).toString(2).length <= space) {
            if (!isNegative) {
                while (value.length < space) {
                    value = '0' + value;
                }
            } else {
                value = value.slice(32 - space);
            }
        } else {
            AssemblerEvent.emit('error', [string + ' cannot be represented as a ' +
                'signed number in ' + space + ' bits.']);
        }

    } else {
        AssemblerEvent.emit('error', ['Expected number but found ' + string + 'instead']);
    }

    return value || '';
};

/**
 * replaces all labels with a binary
 * integers relative to the current address
 *
 * @param string
 * @param offset
 * @param symbols
 * @param address
 * @returns {String}
 *
 */
Parse.label = function (string, offset, symbols, address) {

    var symbol,
        delta;

    for (symbol in symbols) {
        if (symbols.hasOwnProperty(symbol)) {
            delta = symbols[symbol] - address - 1;
            string = string.replace(symbol, this.number('0d' + delta, offset));
        }
    }

    return string;
};

/**
 * The number of parameters supplied
 * does not match the number of parameters
 * required
 *
 * @param parameters
 * @param normal
 */
parameterMismatch = function (parameters, normal) {

    if (parameters !== normal) {
        AssemblerEvent.emit('error', ['The number of parameters ' +
            'supplied does not match the number of parameters ' +
            'required.']);
    }
};

module.exports = Parse;
},{"./AssemblerEvent":2}]},{},[1,2,3])