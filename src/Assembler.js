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