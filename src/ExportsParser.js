const LF = "\n";
const IF_DEF = "#if";
const ENDIF = "#endif";
const BLOC_COMMENT_START = "/*";
const BLOC_COMMENT_END = "*/";
const OPEN_PARENTHESIS = "(";
const CLOSE_PARENTHESIS = ")";
const COLON = ":";
const COMMA = ",";
const AMPERS_GT = ">";
const AMPERS_LT = "<";
const SEMICOLON = ";";
const STAR = "*";
const EQUALS = "=";
const SLASH = "/";
const AMPERS_AND = "&";
const VARIADIC = "...";
const OPEN_BRACKET = "[";
const CLOSE_BRACKET = "]";

const crlfRe = /[\r\n]/mg;
const notSpaceRe = /\S/mg;
const notIdenvifierRe = /\W/mg;

class ExportsParser {
    constructor(noexception = false, options = {}) {
        this.noexception = noexception;
        this.init(options);
    }

    init(options) {
        this.options = options;
        const {lf} = options;
        const {start: export_start, end: export_end} = options.exports;
        this.lf = lf || LF;
        this.export_start = export_start;
        this.export_end = export_end;
        this.export_end_is_space = /\s/.test(export_end);
        this.tokenizer = new RegExp(`(?:^/[/*]|^${ export_start instanceof RegExp ? export_start.source : export_start.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") }|#if)`, "mg");
    }

    parseFile(input, offset = 0) {
        this.lastError = undefined;

        if (Buffer.isBuffer(input)) {
            input = input.toString();
        }

        const {tokenizer, options: {ifeval}} = this;

        let match;

        tokenizer.lastIndex = offset;

        const api = [];

        while ((match = tokenizer.exec(input)) !== null) {
            if (match[0] === "//") {
                tokenizer.lastIndex = input.indexOf(this.lf, match.index) + this.lf.length;
                if (tokenizer.lastIndex - this.lf.length === -1) {
                    tokenizer.lastIndex = input.length;
                }
                continue;
            }

            if (match[0] === BLOC_COMMENT_START) {
                tokenizer.lastIndex = input.indexOf(BLOC_COMMENT_END, match.index) + BLOC_COMMENT_END.length;
                if (tokenizer.lastIndex - BLOC_COMMENT_END.length === -1) {
                    tokenizer.lastIndex = input.length;
                }
                continue;
            }

            if (match[0] === IF_DEF) {
                if (typeof ifeval === "function" ? ifeval(input, match.index) : true) {
                    tokenizer.lastIndex = input.indexOf(this.lf, match.index) + this.lf.length;
                    if (tokenizer.lastIndex - this.lf.length === -1) {
                        tokenizer.lastIndex = input.length;
                    }
                } else {
                    tokenizer.lastIndex = input.indexOf(ENDIF, match.index) + ENDIF.length;
                    if (tokenizer.lastIndex - ENDIF.length === -1) {
                        tokenizer.lastIndex = input.length;
                    }
                }
                continue;
            }

            this.parse(input, match.index);

            if (this.lastError) {
                return null;
            }

            api.push([this.returnType, this.name, this.args]);

            tokenizer.lastIndex = this.pos;
        }

        return api;
    }

    parse(input, pos) {
        if (Buffer.isBuffer(input)) {
            input = input.toString();
        }

        this.start = pos;
        if (this.export_start instanceof RegExp) {
            this.export_start.lastIndex = pos;
            const match = this.export_start.exec(input);
            pos += match[0].length;
        } else {
            pos += this.export_start.length;
        }

        this.input = input;
        this.length = this.input.length;

        this.lastError = undefined;
        this.returnType = undefined;
        this.name = undefined;
        this.args = [];
        this.pos = pos;

        // CVAPI(void) VectorOfDoublePushVector(std::vector< double >* v, std::vector< double >* other);

        // void)
        if (!this.mayBeReturnType()) {
            this.unexpected();
            return;
        }

        this.returnType = this._lastReturnType;
        pos = this.pos;

        // VectorOfDoublePushVector
        if (!this.mayBeIdentifier()) {
            this.unexpected();
            return;
        }

        this.name = this._lastIdentifier;
        pos = this.pos;

        // (std::vector< double >* v, std::vector< double >* other);
        if (!this.mayBeParameters() || !this.mayBeEnd()) {
            this.unexpected();
        }

        this.args = this._lastArgs;
    }

    unexpected() {
        crlfRe.lastIndex = this.pos;
        const match = crlfRe.exec(this.input);
        const eof = match === null ? this.length : match.index;
        const win = 40;
        const start = Math.max(this.start, this.pos - win);
        const end = Math.min(eof, this.pos + win);
        const msg = `Unexpected token ${ this.input.slice(start, end) }`;
        const pad = `${ " ".repeat("Error: Unexpected token ".length + (this.pos - start)) }^`;

        const error = new Error(`${ msg }\n${ pad }`);
        error.pos = this.pos;

        if (this.noexception) {
            this.lastError = error;
        } else {
            throw error;
        }
    }

    isEndOfExports(space) {
        if (this.export_end_is_space) {
            return this.pos !== 0 && (space || /[\s*]/.test(this.input[this.pos - 1]));
        }

        if (!this.input.startsWith(this.export_end, this.pos)) {
            return false;
        }

        this.pos++;
        return true;
    }

    mayBeReturnType() {
        this._lastReturnType = undefined;
        if (this.pos === this.length) {
            return false;
        }

        const {pos} = this;

        this.mayBeType();

        if (!this.export_end_is_space || this._lastTypeRef) {
            this._lastReturnType = this._lastType;
        } else {
            this._lastReturnType = this._lastTypeParts.slice(0, -1).join(" ");
            this.pos = this._lastTypeStart;
        }

        const space = this.mayBeSpace();

        if (this.pos < this.length && this.isEndOfExports(space)) {
            return true;
        }

        this.pos = pos;
        return false;
    }

    mayBeSpace() {
        if (this.pos === this.length) {
            return false;
        }

        const {pos} = this;
        notSpaceRe.lastIndex = pos;

        let trim = true;

        while (trim) {
            const match = notSpaceRe.exec(this.input);
            this.pos = match === null ? this.length : match.index;
            trim = false;

            if (this.pos + 1 < this.length && this.input[this.pos] === SLASH) {
                if (this.input[this.pos + 1] === SLASH) {
                    this.pos = this.input.indexOf(this.lf, this.pos + 2) + 1;
                    if (this.pos === 0) {
                        this.pos = this.length;
                    } else {
                        notSpaceRe.lastIndex = this.pos;
                        trim = true;
                    }
                } else if (this.input[this.pos + 1] === STAR) {
                    this.pos = this.input.indexOf(BLOC_COMMENT_END, this.pos + 2) + 2;
                    if (this.pos === 0) {
                        this.pos = this.length;
                    } else {
                        notSpaceRe.lastIndex = this.pos;
                        trim = true;
                    }
                }
            }
        }

        return this.pos !== pos;
    }

    mayBeIdentifier() {
        this._lastIdentifier = undefined;

        if (this.pos === this.length) {
            return false;
        }

        const {pos} = this;

        this.mayBeSpace();
        const start = this.pos;
        notIdenvifierRe.lastIndex = this.pos;
        const match = notIdenvifierRe.exec(this.input);
        this.pos = match === null ? this.length : match.index;

        if (this.pos !== start) {
            this._lastIdentifier = this.input.slice(start, this.pos);
            return true;
        }

        this.pos = pos;
        return false;
    }

    mayBeExpression() {
        this._lastExpression = undefined;

        if (this.pos === this.length) {
            return false;
        }

        const {pos} = this;

        this.mayBeSpace();
        const start = this.pos;

        while (this.pos < this.length && this.input[this.pos] !== COMMA && this.input[this.pos] !== CLOSE_PARENTHESIS) {
            if (this.input[this.pos] === OPEN_PARENTHESIS) {
                this.pos++;

                let opened = 1;
                while (opened !== 0 && this.pos < this.length) {
                    if (this.input[this.pos] === OPEN_PARENTHESIS) {
                        opened++;
                    } else if (this.input[this.pos] === CLOSE_PARENTHESIS) {
                        opened--;
                    }
                    this.pos++;
                }

                if (opened !== 0) {
                    this.pos = pos;
                    return false;
                }

                this.pos--;
            }

            this.pos++;
        }

        if (this.pos !== start) {
            this._lastExpression = this.input.slice(start, this.pos).trim();
            return true;
        }

        this.pos = pos;
        return false;
    }

    mayBeParameters() {
        if (this.pos === this.length) {
            return false;
        }

        this._lastArgs = [];
        const {pos} = this;

        // (std::vector< double >* v, std::vector< double >* other)
        this.mayBeSpace();

        if (this.pos === this.length || this.input[this.pos++] !== OPEN_PARENTHESIS) {
            this.pos = pos;
            return false;
        }

        this.mayBeSpace();
        let hasMore = this.input[this.pos] !== CLOSE_PARENTHESIS;
        let variadic = false;
        let i = -1;
        const args = this._lastArgs;

        while (hasMore) {
            i++;

            if (!this.mayBeType() || this._lastTypeRef && this._lastType !== "void") {
                this.mayBeSpace();

                if (variadic) {
                    break;
                }

                if (this.input.startsWith(VARIADIC, this.pos)) {
                    this.pos += VARIADIC.length;
                    variadic = true;
                } else if (this._lastTypeRef) {
                    // unamed variable
                    this._lastTypeRef = false;
                    this._lastTypeParts.push(`__arg${ i }`);
                }
            }

            // last type must end with an identifier
            if (!variadic && this._lastTypeRef) {
                // unamed variable
                this._lastTypeParts.push(`__arg${ i }`);
            }

            if (this._lastType === "void") {
                this._lastTypeParts.push(undefined);
            }

            hasMore = false;

            const arg = variadic ? args.pop() : [this._lastTypeParts.slice(0, -1).join(" "), this._lastTypeParts[this._lastTypeParts.length - 1]];
            arg.variadic = variadic;

            if (variadic) {
                arg[0] += "*";
            }

            args.push(arg);

            this.mayBeSpace();

            if (this.pos < this.length && this.input[this.pos] === OPEN_PARENTHESIS) {
                if (this._lastType !== "void") {
                    hasMore = true;
                    break;
                }

                this.pos++;
                this.mayBeSpace();

                if (this.pos === this.length || this.input[this.pos++] !== STAR) {
                    hasMore = true;
                    break;
                }

                this.mayBeSpace();

                if (!this.mayBeIdentifier()) {
                    hasMore = true;
                    break;
                }

                arg[0] += "*";
                arg[1] = this._lastIdentifier;

                this.mayBeSpace();

                if (this.pos === this.length || this.input[this.pos++] !== CLOSE_PARENTHESIS) {
                    hasMore = true;
                    break;
                }

                this.mayBeSpace();

                if (this.pos === this.length || this.input[this.pos++] !== OPEN_PARENTHESIS) {
                    hasMore = true;
                    break;
                }

                let opened = 1;

                while (opened !== 0 && this.pos !== this.length) {
                    if (this.input[this.pos] === OPEN_PARENTHESIS) {
                        opened++;
                    } else if (this.input[this.pos] === CLOSE_PARENTHESIS) {
                        opened--;
                    }
                    this.pos++;
                }

                if (opened !== 0) {
                    hasMore = true;
                    break;
                }
            }

            if (this.pos < this.length && this.input[this.pos] === OPEN_BRACKET) {
                this.pos++;
                this.mayBeSpace();
                const end = this.pos === this.length ? -1 : this.input.indexOf(CLOSE_BRACKET, this.pos);

                if (end === -1) {
                    hasMore = true;
                    break;
                }

                this.pos = end + 1;
                arg[0] += "*";
            }

            if (this.pos < this.length && this.input[this.pos] === EQUALS) {
                this.pos++;
                this.mayBeSpace();
                if (!this.mayBeExpression()) {
                    break;
                }
                arg.push(this._lastExpression);
            }

            if (this.pos < this.length && this.input[this.pos] === COMMA) {
                this.pos++;
                hasMore = true;
                if (this._lastType === "void") {
                    break;
                }
            }
        }

        if (!hasMore) {
            this.mayBeSpace();
            if (this.pos === this.length || this.input[this.pos++] !== CLOSE_PARENTHESIS) {
                hasMore = true;
            }
        }

        if (!hasMore) {
            return true;
        }

        this.pos = pos;
        return false;
    }

    mayBeEnd() {
        if (this.options.mayBeEnd) {
            this.options.mayBeEnd.call(this);
        }

        this.mayBeSpace();

        if (this.pos === this.length || this.input[this.pos] !== SEMICOLON) {
            return false;
        }

        this.pos++;
        return true;
    }

    mayBeType() {
        this._lastType = undefined;
        this._lastTypeRef = false;
        this._lastTypeStart = this.pos;

        if (this.pos === this.length) {
            return false;
        }

        const {pos} = this;

        const parts = [];

        let isReference = false;
        let hasType = false;

        while (true) { // eslint-disable-line no-constant-condition
            const _lastTypeStart = this._lastTypeStart;
            this._lastTypeStart = this.pos;

            if (!this.mayBeIdentifier()) {
                if (hasType) {
                    this._lastTypeStart = _lastTypeStart;
                    break;
                }

                this.pos = pos;
                return false;
            }

            hasType = true;
            isReference = false;

            parts.push(this._lastIdentifier);

            if (this._lastIdentifier === "const" || this._lastIdentifier === "volatile") {
                this.mayBeReference(parts);
                continue;
            }

            if (this.input[this.pos] === COLON) {
                this.pos++;

                if (this.pos === this.length || this.input[this.pos++] !== COLON || !this.mayBeType()) {
                    this.pos = pos;
                    return false;
                }

                isReference = this._lastTypeRef;
                const namespace = `${ parts.pop() }::${ this._lastTypeParts.shift() }`;
                parts.push([namespace].concat(this._lastTypeParts.slice(0, -1)).join(" "));
                if (this._lastTypeParts.length !== 0) {
                    parts.push(this._lastTypeParts[this._lastTypeParts.length - 1]);
                }
                break;
            }

            if (this.input[this.pos] === AMPERS_LT) {
                this.pos++;
                if (!this.mayBeType()) {
                    this.pos = pos;
                    return false;
                }

                this.mayBeSpace();

                if (this.pos === this.length || this.input[this.pos++] !== AMPERS_GT) {
                    this.pos = pos;
                    return false;
                }

                parts[parts.length - 1] += `<${ this._lastType }>`;

                isReference = this.mayBeReference(parts);
                continue;
            }

            isReference = this.mayBeReference(parts);
        }

        this._lastType = parts.join(" ");
        this._lastTypeParts = parts;
        this._lastTypeRef = isReference;
        return true;
    }

    mayBeReference(parts) {
        if (this.pos === this.length) {
            return false;
        }

        const {pos} = this;
        this.mayBeSpace();

        let stars = "";

        while (this.pos < this.length && (this.input[this.pos] === STAR || this.input[this.pos] === AMPERS_AND)) {
            stars += this.input[this.pos];
            this.pos++;
            this.mayBeSpace();
        }

        if (stars === "") {
            this.pos = pos;
            return false;
        }

        parts[parts.length - 1] += stars;
        return true;
    }
}

module.exports = ExportsParser;
