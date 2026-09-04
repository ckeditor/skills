/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * Throws the message as an error unless the condition holds, so that a series of checks reads as a list of what
 * must be true rather than a chain of `if` blocks.
 *
 * @param {boolean} condition
 * @param {string} message
 */
export function assert( condition, message ) {
	if ( !condition ) {
		throw new Error( message );
	}
}

/**
 * Formats names for an error message: each in quotes, separated by commas, or the word `nothing` for no names.
 *
 * @param {Array.<string>} names
 * @returns {string}
 */
export function quote( names ) {
	return names.length ? names.map( name => `"${ name }"` ).join( ', ' ) : 'nothing';
}
