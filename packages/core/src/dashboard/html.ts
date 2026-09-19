/**
 * Tagged template literal used to author dashboard components as plain HTML strings.
 * Interpolated arrays are joined without separators, allowing you to `.map()` over lists.
 */
export function html(strings: TemplateStringsArray, ...values: (string | string[])[]) {
	const treatedValues = values.map((value) => (Array.isArray(value) ? value.join('') : value));

	return String.raw({ raw: strings }, ...treatedValues);
}
