// Read the live tool state at navigation time; never persist user input.
let check;
export function registerContentCheck(callback){check=callback;}
export function hasUserContent(){return Boolean(check?.());}
