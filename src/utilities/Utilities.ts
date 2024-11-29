import { buildRegExp, Pattern } from 'regexp-composer'

export function roundToDigits(val: number, digits = 3) {
	const multiplier = 10 ** digits

	return Math.round(val * multiplier) / multiplier
}

export function listAllCharsMatching(charPattern: Pattern) {
	const regExp = buildRegExp(charPattern)

	const matchingChars: string[] = []

	for (let codepoint = 0; codepoint < 1114111; codepoint++) {
		const char = String.fromCodePoint(codepoint)

		if (regExp.test(char)) {
			matchingChars.push(char)
		}
	}

	return matchingChars
}

export function extractSuppressions(entries: { suppression: string}[]) {
	const suppressions: string[] = []

	for (const entry of entries) {
		suppressions.push(entry.suppression)
	}

	return suppressions
}
