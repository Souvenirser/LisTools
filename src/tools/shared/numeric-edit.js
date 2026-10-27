export function isIncompleteNumber(value){
 const input=value.trim();return /^[+\-]?(?:\.|)$/.test(input)||/^[+\-]?(?:\d+(?:\.\d*)?|\.\d+)e[+\-]?$/i.test(input)||/^[+\-]?\d+\.$/.test(input)||/^[+\-]?\d{1,3}(?:,\d{3})*,\d{0,2}$/.test(input);
}
