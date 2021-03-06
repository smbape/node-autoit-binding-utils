const {hasOwnProperty: hasProp} = Object.prototype;

const AUTOIT_TYPE_MAP = {
    bool: "boolean",
    void: "none",
    size_t: "ulong_ptr",
    char: "byte",
    "unsigned char": "byte",
    uchar: "byte",
    "unsigned short": "ushort",
    unsigned: "uint",
    "unsigned int": "uint",
    "unsigned long": "ulong",
    "long double": "double",
};

const NATIVE_TYPES_REG = new RegExp(`^(?:const\\s+|volatile\\s+)*(?:${ [
    "boolean",
    "bool",
    "short",
    "ushort",
    "int",
    "uint",
    "long",
    "ulong",
    "float",
    "double",
].join("|") })\\s*\\*?`);

const AUTOIT_VALID_TYPE = [
    "NONE",
    "BYTE",
    "BOOLEAN",
    "SHORT",
    "USHORT",
    "WORD",
    "INT",
    "LONG",
    "BOOL",
    "UINT",
    "ULONG",
    "DWORD",
    "INT64",
    "UINT64",
    "PTR",
    "HWND",
    "HANDLE",
    "FLOAT",
    "DOUBLE",
    "INT_PTR",
    "LONG_PTR",
    "LRESULT",
    "LPARAM",
    "UINT_PTR",
    "ULONG_PTR",
    "DWORD_PTR",
    "WPARAM",
    "STR",
    "WSTR",
    "STRUCT ",
];

const assertValidDllType = otype => {
    if (otype.startsWith("$")) {
        return otype;
    }

    let type = otype;

    if (type[0] === "\"") {
        type = type.slice(1, -1);
    }

    if (type.endsWith("*")) {
        type = type.slice(0, -1);
    }

    if (AUTOIT_VALID_TYPE.indexOf(type.toUpperCase()) === -1) {
        throw new Error(`${ otype } is not a valid autoit type`);
    }

    return otype;
};

const getAutoItType = (type, native = false) => {
    const byRef = type.endsWith("*");

    if (!native && byRef) {
        return "ptr";
    }

    if (hasProp.call(AUTOIT_TYPE_MAP, type)) {
        return AUTOIT_TYPE_MAP[type];
    }

    if (native && byRef && hasProp.call(AUTOIT_TYPE_MAP, type.slice(0, -1))) {
        return `${ AUTOIT_TYPE_MAP[type] }*`;
    }

    return type.replace(/\b(?:const|volatile)\s+/g, "");
};

const getAutoItFunctionDefinition = (entry, options = {}) => {
    const {cdecl, defaults, isbyref, overrides, retwrap, rettype, fnwrap, declaration, getAutoItDllType, getAutoItType: _getAutoItType} = options;

    const declarations = [];
    const destructors = [];
    const oReturnType = entry[0];

    if (entry[1] === "g_signal_connect_data") {
        debugger;
    }

    if (typeof overrides === "function") {
        if (overrides(entry, declarations, destructors, options) === false) {
            return "";
        }
    }

    let returnType = entry[0];
    const [, name, args] = entry;
    const isVoid = returnType === "void";
    const autoItReturnType = assertValidDllType(getAutoItType(typeof _getAutoItType === "function" ? _getAutoItType(returnType, options) : returnType));

    const autoItArgs = [];
    const declArgs = [];
    const dllArgs = [cdecl ? `"${ autoItReturnType }:cdecl"` : `"${ autoItReturnType }"`, `"${ name }"`];
    let hasNoArgs = false;

    for (const arg of args) {
        const [, argName, defaultValue] = arg;
        let argType = arg[0];

        if (argType === "void") {
            if (hasNoArgs || argName !== undefined) {
                throw new Error(`${ name } is supposed to have no arguments but found one`);
            }
            hasNoArgs = true;
            continue;
        }

        declArgs.push(`${ argType } ${ argName }`);

        if (typeof _getAutoItType === "function") {
            argType = _getAutoItType(argType, options);
        }

        const isString = /^const char\*\*?$/.test(argType);
        const isNativeType = NATIVE_TYPES_REG.test(argType);

        const capitalCasedName = argName[0].toUpperCase() + argName.slice(1);

        let byRef = arg[3];
        if (byRef === undefined) {
            byRef = argType.endsWith("*") || argType.endsWith("&");

            if (byRef && isNativeType && argType.startsWith("const ")) {
                byRef = false;
            }

            if (typeof isbyref === "function") {
                byRef = isbyref(argType, arg, entry, options, byRef);
            }

            arg[3] = byRef;
        }

        if (defaultValue !== undefined) {
            declArgs[declArgs.length - 1] += ` = ${ defaultValue }`;
        }

        const autoItArgName = `$${ argName }`;
        let dllArgName = autoItArgName;

        if (typeof defaults === "function") {
            arg[2] = defaults(name, argName, defaultValue);
        } else if (defaults !== null && typeof defaults === "object" && hasProp.call(defaults, name)) {
            if (typeof defaults[name] === "function") {
                arg[2] = defaults[name](argName, defaultValue);
            } else if (defaults[name] !== null && typeof defaults[name] === "object" && hasProp.call(defaults[name], argName)) {
                arg[2] = defaults[name][argName];
            }
        }

        if (typeof declaration === "function") {
            const newDllArgName = declaration(dllArgName, arg, declarations, destructors, entry, options);
            if (typeof newDllArgName === "string") {
                dllArgName = newDllArgName;
            }
        }

        if (arg[2] !== undefined) {
            autoItArgs.push(`${ autoItArgName } = ${ arg[2] }`);
        } else {
            autoItArgs.push(autoItArgName);
        }

        let autoItDllType;

        if (byRef || argType.endsWith("*") || argType.endsWith("&")) {
            let typeCondition = "";

            if (argType.endsWith("**")) {
                autoItDllType = "ptr*";
                typeCondition = `ElseIf ${ autoItArgName } == Null Then
                    $s${ capitalCasedName }DllType = "ptr"
                `;
            } else if (isString) {
                autoItDllType = "str";
                typeCondition = `ElseIf IsPtr(${ autoItArgName }) Then
                    $s${ capitalCasedName }DllType = "ptr"
                `;
            } else if (isNativeType) {
                autoItDllType = getAutoItType(argType, isNativeType);
            } else {
                autoItDllType = "ptr";
            }

            declarations.push(""); // new line
            declarations.push(...`
                Local $s${ capitalCasedName }DllType
                If IsDllStruct(${ autoItArgName }) Then
                    $s${ capitalCasedName }DllType = "struct*"
                ${ typeCondition }Else
                    $s${ capitalCasedName }DllType = "${ autoItDllType }"
                EndIf
            `.replace(/^ {16}/mg, "").trim().split("\n"));
            autoItDllType = `$s${ capitalCasedName }DllType`;
        } else {
            autoItDllType = `"${ getAutoItType(argType, isNativeType) }"`;
        }

        if (typeof getAutoItDllType === "function") {
            autoItDllType = getAutoItDllType(autoItDllType, isNativeType, arg, entry, options);
        }

        dllArgs.push(assertValidDllType(autoItDllType), dllArgName);
    }


    for (let i = autoItArgs.length - 1, canDefault = true; i >= 0; i--) {
        const arg = args[i];
        // const [argType] = arg;
        const value = autoItArgs[i];
        const pos = value.indexOf(" = ");
        const hasDefault = pos !== -1;

        if (canDefault) {
            canDefault = hasDefault;
        } else if (hasDefault) {
            autoItArgs[i] = value.slice(0, pos);
            arg[4] = false;
        }
    }

    const dllvar = typeof options.dllvar === "function" ? options.dllvar(entry, options) : options.dllvar;
    let retval = `DllCall(${ dllvar }, ${ dllArgs.join(", ") })`;

    if (typeof retwrap === "function") {
        retval = retwrap(retval, entry, options);
    }

    if (typeof rettype === "function") {
        returnType = rettype(oReturnType, entry, options);
    } else {
        returnType = oReturnType;
    }

    const indent = " ".repeat(12);
    const hasDesctructor = destructors.length !== 0;

    const body = [];
    body.push(`; ${ returnType } ${ name }(${ declArgs.join(", ") });`);
    body.push(...declarations);

    if (isVoid) {
        if (declarations.length !== 0) {
            body.push(""); // new line
        }
        body.push(retval);
    } else if (hasDesctructor) {
        if (declarations.length !== 0) {
            body.push(""); // new line
        }
        body.push(`Local $retval = ${ retval }`);
    } else {
        body.push(`Return ${ retval }`);
    }

    body.push(...destructors);

    if (!isVoid && hasDesctructor) {
        body.push(""); // new line
        body.push("Return $retval");
    }

    let func = `
        Func _${ name }(${ autoItArgs.join(", ") })
            ${ body.join(`\n${ indent }`) }
        EndFunc   ;==>_${ name }
    `.replace(/^ {8}/mg, "").trim();

    if (typeof fnwrap === "function") {
        func = fnwrap(func, name, entry, options);
    }

    return func.replace(/[^\S\n]+(?=\r?\n)/mg, "");
};

const convertToAutoIt = (api, options = {}) => {
    const seen = new Set();
    const body = [];

    for (const entry of api) {
        const name = entry[1];
        if (seen.has(name)) {
            continue;
        }
        seen.add(name);

        if (options.invalid) {
            try {
                const text = getAutoItFunctionDefinition(entry, options);
                if (text !== "") {
                    body.push(text);
                }
            } catch (err) {
                console.log("ignore invalid entry", entry, err.message);
                continue;
            }
        } else {
            const text = getAutoItFunctionDefinition(entry, options);
            if (text !== "") {
                body.push(text);
            }
        }
    }

    return body.join("\n\n");
};

Object.assign(exports, {
    getAutoItType,
    getAutoItFunctionDefinition,
    convertToAutoIt,
});
