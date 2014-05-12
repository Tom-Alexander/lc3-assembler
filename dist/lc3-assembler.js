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

    var firstPass,
        lineNumber,
        didFindEnd = false,
        addressNumber = 0,
        parsedInstruction,
        operation,
        symbolTable = [],
        machineCode = [],
        processedCode = [],
        code = source.replace(/;.*\n/g, '\n').replace(/(^[ \t]*\n)/gm, '').trim().split('\n'),
        currentInstruction;

    firstPass = function (instruction, didAddLabel, lineNumber, addressNumber) {

        if (!didAddLabel) {

            if (!Parse.instruction.hasOwnProperty(instruction[0])) {
                symbolTable[instruction[0]] = addressNumber;
                instruction.shift();
                firstPass(instruction, true, lineNumber, addressNumber);
            }

        }

        return instruction;

    };

    // FIRST PASS
    for (lineNumber = 0; lineNumber < code.length; lineNumber += 1) {

        AssemblerEvent.lineNumber(lineNumber);
        currentInstruction = Parse.line(code[lineNumber]);

        if (currentInstruction[0] === '.END') {
            didFindEnd = true;
            break;
        }

        currentInstruction = firstPass(currentInstruction, false, lineNumber, addressNumber);
        operation = currentInstruction[0];

        if (lineNumber === 0 && operation !== '.ORIG') {
            AssemblerEvent.emit('error', ['Expected ".ORIG" but found "' + operation + '".']);
        }

        if (!Parse.instruction.hasOwnProperty(operation)) {
            AssemblerEvent.emit('error', ['Unknown operation "' + operation + '".']);
            didFindEnd = true;
            break;
        }

        currentInstruction = Parse.instruction[operation](currentInstruction);

        if (typeof currentInstruction.instruction === 'string' || currentInstruction.instruction instanceof String) {
            machineCode[lineNumber] = [currentInstruction];
            addressNumber += 1;
        }

        if (Object.prototype.toString.call(currentInstruction) === '[object Array]') {
            machineCode[lineNumber] = currentInstruction;
            addressNumber += currentInstruction.length;
        }

    }

    if (!didFindEnd) {
        AssemblerEvent.emit('error', ['Expected .END']);
    }

    // SECOND PASS
    for (lineNumber = 0; lineNumber < machineCode.length; lineNumber += 1) {

        AssemblerEvent.lineNumber(lineNumber);

        for (var i = 0; i < machineCode[lineNumber].length; i += 1) {

            if (machineCode[lineNumber][i].hasOwnProperty('labelOffset')) {

                parsedInstruction = Parse.label(
                    machineCode[lineNumber][i].instruction,
                    machineCode[lineNumber][i].labelOffset,
                    symbolTable,
                    lineNumber + i
                );

                if (parsedInstruction === machineCode[lineNumber][i].instruction) {
                    AssemblerEvent.emit('error', ['instruction references an undefined label.']);
                }

                processedCode.push(parsedInstruction);

            } else {
                processedCode.push(machineCode[lineNumber][i].instruction);
            }

        }
    }

    this.machineCode = processedCode;
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

    var DR = Parse.registers(instruction[1]),
        SR1 = Parse.registers(instruction[2]),
        isImmediate = instruction[3].indexOf('R') < 0,
        SR2;

    SR2 = isImmediate ? '1' + Parse.number(instruction[3], 5) : '000' + Parse.registers(instruction[3]);
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
        isImmediate = instruction[3].indexOf('R') < 0,
        SR2;

    SR2 = isImmediate ? '1' + Parse.number(instruction[3], 5) : '000' + Parse.registers(instruction[3]);
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

    parameterMismatch(instruction.length, 3);

    var condition = [0, 0, 0],
        PCOffset9 = instruction[2];

    condition[0] = instruction[1].indexOf('n') >= 0 ? 1 : 0;
    condition[1] = instruction[1].indexOf('z') >= 0 ? 1 : 0;
    condition[2] = instruction[1].indexOf('p') >= 0 ? 1 : 0;

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
    parameterMismatch(instruction.length, 2);

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
    parameterMismatch(instruction.length, 2);

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
    parameterMismatch(instruction.length, 3);

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
    parameterMismatch(instruction.length, 3);

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
    parameterMismatch(instruction.length, 4);

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
    parameterMismatch(instruction.length, 3);

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
Parse.instruction.RET = function (instruction) {

    parameterMismatch(instruction.length, 1);

    return {instruction: '1100000111000000'};
};

/**
 * RTI operation
 *
 * @returns {}
 */
Parse.instruction.RTI = function (instruction) {
    parameterMismatch(instruction.length, 1);

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
        offset6 = instruction[3];

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
Parse.instruction['.ORIG'] = function (instruction) {
    parameterMismatch(instruction.length, 2);
    return {instruction: Parse.number('0d' + instruction[1], 16)};
};

/**
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction['.FILL'] = function (instruction) {
    parameterMismatch(instruction.length, 2);

    return {instruction: Parse.number('0d' + instruction[1], 16)};
};

/**
 *
 * @param instruction
 * @returns {}
 */
Parse.instruction['.BLKW'] = function (instruction) {
    var instructions = [],
        i;

    parameterMismatch(instruction.length, 2);

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
Parse.instruction['.STRINGZ'] = function (instruction) {
    var i,
        instructions = [],
        value = instruction[1].replace(/["]/g, '');

    parameterMismatch(instruction.length, 2);

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
Parse.instruction.GETC = function (instruction) {
    parameterMismatch(instruction.length, 1);
    return {instruction: '11110000' + '00100000'};
};

Parse.instruction.OUT = function (instruction) {
    parameterMismatch(instruction.length, 1);
    return {instruction: '11110000' + '00100001'};
};

Parse.instruction.PUTS = function (instruction) {
    parameterMismatch(instruction.length, 1);
    return {instruction: '11110000' + '00100010'};
};

Parse.instruction.HALT = function (instruction) {
    parameterMismatch(instruction.length, 1);
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

    var quotedStrings;
    line = line.replace(/\s*(,|^|$)\s*/g, "$1");

    if (line.indexOf('BR') >= 0) {
        line = line.slice(line.indexOf('BR'), line.indexOf('BR') + 2) + ',' + line.slice(line.indexOf('BR') + 2);
    }

    quotedStrings = line.match(/"(.*?)"/g);

    if (quotedStrings) {
        line = line.replace(quotedStrings[0], '{}');
    }

    if (line.indexOf(';') >= 0) {
        line = line.substring(0, line.indexOf(';')).trim();
    }

    line = line.replace(/[ ]/g, ',').trim();

    if (quotedStrings) {
       line = line.replace('{}', quotedStrings[0]);
    }

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

    var parsedRegister = '';

    if (register.indexOf('R') >= 0 || register.indexOf('r') >= 0) {

        parsedRegister = this.number('0d' + register.substring(1, 2), 3);

        if (parseInt(parsedRegister, 2) > 7 || parseInt(parsedRegister, 2) < 0) {
            AssemblerEvent.emit('error', ['Unknown register "' + register + '".']);
        }

    } else {
        AssemblerEvent.emit('error', ['Unknown register "' + register + '".']);
    }

    return parsedRegister;

};

/**
 * Converts a string into a signed binary integer
 * in a certain number of bits
 *
 * @param string
 * @param space
 * @returns {*|string}
 */
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
            AssemblerEvent.emit('error', ['"' + string + '" cannot be represented as a ' +
                'signed number in ' + space + ' bits.']);
        }

    } else {
        AssemblerEvent.emit('error', ['Expected number but found "' + string + '" instead']);
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
 * @param supplied
 * @param required
 */
parameterMismatch = function (supplied, required) {

    if (supplied !== required) {
        AssemblerEvent.emit('error', ['The number of parameters ' +
            'supplied does not match the number of parameters ' +
            'required.']);
    }
};

module.exports = Parse;
},{"./AssemblerEvent":2}]},{},[1,2,3])