const convertExpression = (input, options, offset = 0) => {
    input = input.replace(/\b(\d+)[ul]/g, "$1");

    const tokenizer = /(?:\s+|[()~|&+/*-]|<<|>>)/mg;
    tokenizer.lastIndex = offset;

    let op = "";
    const ans = [];
    let last = "";
    let lastIndex = offset;
    let opened = 0;
    let pexpr = "";
    let match, expr;

    while ((match = tokenizer.exec(input)) !== null) {
        if (match[0] === "(") {
            if (opened++ === 0) {
                pexpr = input.slice(lastIndex, tokenizer.lastIndex);
                lastIndex = tokenizer.lastIndex;
            }
            continue;
        }

        if (match[0] === ")") {
            if (--opened === 0) {
                pexpr += convertExpression(input.slice(lastIndex, match.index), options, 0) + match[0];
                lastIndex = tokenizer.lastIndex;
            }
            continue;
        }

        if (opened !== 0) {
            continue;
        }

        if (/^\s/.test(match[0])) {
            continue;
        }

        expr = pexpr + input.slice(lastIndex, match.index);
        pexpr = "";
        lastIndex = tokenizer.lastIndex;

        switch (op) {
            case "<<":
            case ">>":
            case "~":
            case "&":
            case "|":
                ans.push(last.trim(), op);
                last = expr;
                break;
            default:
                last += op + expr;
        }

        op = match[0];
    }

    expr = pexpr + input.slice(lastIndex);

    switch (op) {
        case "<<":
        case ">>":
        case "~":
        case "&":
        case "|":
            last = last.trim();
            if (last.length === 0) {
                ans.push(op, expr.trim());
            } else {
                ans.push(last, op, expr.trim());
            }
            break;
        default:
            ans.push((last + op + expr).trim());
    }

    for (let i = ans.length - 1, right; i >= 0; i--) {
        switch (ans[i]) {
            case "<<":
                ([, right] = ans.splice(i, 2));
                if (/\W/.test(right)) {
                    right = `(${ right })`;
                }
                ans[i - 1] = `BitShift(${ ans[i - 1] }, -${ right })`;
                i--;
                break;
            case ">>":
                ([, right] = ans.splice(i, 2));
                ans[i - 1] = `BitShift(${ ans[i - 1] }, ${ right })`;
                i--;
                break;
            case "~":
                ([, right] = ans.splice(i, 2));
                ans[i] = `BitNOT(${ right })`;
                break;
            case "&":
                ([, right] = ans.splice(i, 2));
                ans[i - 1] = `BitAND(${ ans[i - 1] }, ${ right })`;
                i--;
                break;
            case "|":
                ([, right] = ans.splice(i, 2));
                ans[i - 1] = `BitOR(${ ans[i - 1] }, ${ right })`;
                i--;
                break;
            default:
                // Nothing to do
        }
    }

    return ans.join(" ").trim();
};

exports.convertExpression = convertExpression;
