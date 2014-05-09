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