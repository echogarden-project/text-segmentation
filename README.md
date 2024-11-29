# Echogarden text segmentation library

A library providing word, phrase and sentence segmentation for natural language text.

* Fully **multilingual**. Covers all languages and writing systems representable as Unicode characters. When needed, applies second stage processing using a [WebAssembly port](https://github.com/echogarden-project/icu-segmentation-wasm) of the [ICU C++ Library](https://icu.unicode.org/) (if available) for handling difficult to segment east-Asian languages, like Chinese, Japanese, Thai and Khmer
* Segments **mixtures of different languages**, including mixtures of different scripts, like Chinese, Cyrillic and Latin, all within a single sentence or phrase, without needing to explicitly specify a particular language
* Includes **built-in suppression lists** for language-specific abbreviations and special word patterns. Currently included languages are English, German, Spanish, French, Italian, Portuguese and Russian, mostly extracted from the [CLDR JSON datasets](https://github.com/unicode-org/cldr-json)
* Accepts **user-provided suppression lists**
* **Very fast**. For most languages, word segmentation is done mostly via a single regular expression, dynamically built for the given options, and suppression set. Majority of processing is done within the JavaScript regular expression engine, or within optimized WebAssembly binaries
* Written in TypeScript

## Installation

```
npm install @echogarden/text-segmentation
```

To enable fine-grained segmentation of Chinese, Japanese, Thai and Khmer words, install this additional package:

```
npm install @echogarden/icu-segmentation-wasm
```

(`@echogarden/icu-segmentation-wasm` is a 27 MB package, and is set as a [peer dependency](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#peerdependencies). For size reasons, it's not installed by default, to ease on deployments that may not require it - especially browsers)

## Usage

### Splitting to words
```ts
import { splitToWords } from '@echogarden/text-segmentation'

const wordSequence: WordSequence =
  await splitToWords('Hello, world! How are you doing today?', { language: 'en' })

console.log(wordSequence.words)
```
Prints a list of words (including spaces and punctuation):

```ts
['Hello', ',', ' ', 'world', '!', ' ', 'How',' ', 'are', ' ', 'you', ' ', 'doing', ' ', 'today', '?']
```

### Language mixtures

A language option provided like `language: 'en'` is only used for loading suppression dictionaries. You can still include mixtures of different languages and scripts within the same input text:

```ts
await splitToWords('Hello world! Привет мир! 你好世界！')
```

Producing:
```ts
['Hello', ' ', 'world', '!', ' ', 'Привет', ' ', 'мир', '!', ' ', '你好', '世界', '！']
```

### Getting detailed metadata

To get more detailed information,
```ts
console.log(wordSequence.entries)
```

prints a list of objects, including metadata on each word:

```ts
[
  { text: 'Hello', startOffset: 0, endOffset: 5, isPunctuation: false },
  { text: ',', startOffset: 5, endOffset: 6, isPunctuation: true },
  { text: ' ', startOffset: 6, endOffset: 7, isPunctuation: true },
  { text: 'world', startOffset: 7, endOffset: 12, isPunctuation: false },
  { text: '!', startOffset: 12, endOffset: 13, isPunctuation: true },
  { text: ' ', startOffset: 13, endOffset: 14, isPunctuation: true },
  { text: 'How', startOffset: 14, endOffset: 17, isPunctuation: false },
  { text: ' ', startOffset: 17, endOffset: 18, isPunctuation: true },
  { text: 'are', startOffset: 18, endOffset: 21, isPunctuation: false },
  { text: ' ', startOffset: 21, endOffset: 22, isPunctuation: true },
  { text: 'you', startOffset: 22, endOffset: 25, isPunctuation: false },
  { text: ' ', startOffset: 25, endOffset: 26, isPunctuation: true },
  { text: 'doing', startOffset: 26, endOffset: 31, isPunctuation: false },
  { text: ' ', startOffset: 31, endOffset: 32, isPunctuation: true },
  { text: 'today', startOffset: 32, endOffset: 37, isPunctuation: false },
  { text: '?', startOffset: 37, endOffset: 38, isPunctuation: true }
]
```

### Segmenting to words, phrases and sentences

```ts
const result: SegmentationResult =
  await segmentText(`Hello, world! How are you doing today?`)
```

`result` is a nested object containing a breakdown of sentences, phrases and words in the given text. It is described by these TypeScript types:
```ts
interface SegmentationResult {
	wordSequence: WordSequence
	sentences: Sentence[]
}

interface Sentence {
	text: string
	charRange: Range
	wordRange: Range
	wordSequence: WordSequence

	phrases: Phrase[]
}

interface Phrase {
	text: string
	charRange: Range
	wordRange: Range
	wordSequence: WordSequence
}

interface Range {
	start: number
	end: number
}
```

### Segmenting a predefined word sequence

If you have a pre-existing `WordSequence` object (or possibly a modified form of an existing one), you can segment it to sentences and phrases without needing to recompute the word boundaries:

```ts
const result: SegmentationResult = await segmentWordSequence(wordSequence: WordSequence)
```

In this way, you can also specify custom word boundaries, and the phrase and sentence segmentation operations would ensure that break characters are never identified within the spans of non-punctuation words.

## Algorithm outline

### Word segmentation

Looks for one out of several accepted character sequence patterns, and identifies that pattern as an individual word.

There are several types of accepted patterns, evaluated in this order:
* User-provided suppressions
* Language-specific suppressions. For example, in English it would include abbreviations like `Mr.`, `Mrs.`, `e.g.`, `i.e`, `etc.`, or contractions like and `'cause`, `'bout` in English, `'n` in Afrikaans
* Noun suppressions, shared in all languages, like names of brands, misc. abbreviations and programming languages. Examples: `C#`, `F#`, `C++`, `Yahoo!`, `Toys"R"Us`, `Dunkin'`, `Ke$ha`, `Sky+`, `I/O`, `A/C`, `A/V`
* Top-level domains, like `.com`, `.org`, `.net` (also doubling as the noun `.NET` as in the ".NET framework")
* Number patterns, consisting of a sequences of digits separated by various separator characters, like decimal separators `3.14`, `3,14`, and thousands separators like `233,421` (`,`), `233.421` (`.`) or `233 421` (` `). optional `-` or `+` signs like `-34,534.123`, `+43 345,344`
* Date, time, and phone number patterns, consisting of digits separated by characters like `/`, `:`, `-`, like `15:23:23`, `1953/11/06`, `64-534-756`
* Percentage patterns, which are a subset of number patterns preceded or followed by `%`, like `53.243%` or `%34.12`
* Currency patterns like `$101.25`, `€50`, `20£`, `-53.23¥`, which, like percentage patterns, are number patterns preceded or followed by a currency symbol
* Abbreviation patterns like `Y.M.C.A`: these patterns will be automatically matched (no special suppressions needed) if there is a sequence of single `.` alternating between single letters (like `x.y.z`), optionally, there may be a space between the characters, like `x. y. z.`
* **And finally** (but most importantly): word character sequences consisting of letter characters (Unicode category `Letter`), mark characters (Unicode category `Mark`) or digit characters (Unicode category `Decimal_Number`), which may include inner apostrophes like `'` and `’` and inner separators like `-`, `_` `·`

**Current limitations**:
* No current general identification of preceding or trailing apostrophes, like in English possessive plurals "The brothers' friend" or "The diplomats' contracts". **Reason**: this requires a large lexicon or more sophisticated language understanding, since the apostrophe is generally ambiguous with a single quote.

#### Further segmentation for words containing Chinese, Japanese, Thai, or Khmer characters

This requires the the `@echogarden/icu-segmentation-wasm` package to be **manually** installed.

* Iterate each previously identified word span
* Check if the word span contains at at least one codepoint belonging to the supported east Asian languages character ranges
* Load the ICU module on the first match that is found (due to a startup delay of about `40ms` - `80ms`, the module is only loaded if absolutely needed)
* Split the word span further using the ICU library


### Sentence and phrase segmentation

**Sentence segmentation**:
* Split to words, or use a pre-supplied word sequence
* Identify sentence enders, like `.`, `。`, `?`, `？`, `!`, `！` or a line break, outside word spans, and identify sentence boundaries based on them
* Extend sentence spans with any number of possible trailing punctuation characters, after the ender character, like `”`, `’`, `)`, `]`, `}`, `»`, line breaks or other whitespace

**Phrase segmentation**:
* Iterate over the sentences detected
* Within each sentence, identify phrase separators like `,`, `、`, `，`, `،`, `；`, `;`, `:`, `：`, `—` outside word spans, and split phrases based on them
* Extend phrase spans with any number of trailing punctuation characters, up to the end of the containing sentence


## License

MIT
