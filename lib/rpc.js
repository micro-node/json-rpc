import * as _ from 'lodash';

// leaf types
export const FUNCTIONTYPE = 'function';
export const VALUETYPE = 'value';

export const DEFINITIONMETHOD = '$definition';

// some cool regexp
const FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
const FN_ARG_SPLIT = /,/;
const FN_ARG = /^\s*(_?)(.+?)\1\s*$/;
const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

//RPC version
export const JSONRPCVERSION = '2.0';

// errors
export const INVALIDREQUEST = -32600;
export const METHODNOTFOUND = -32601;

export function parameterNames(fn){

  let params = [];

  let fnText = fn.toString().replace(STRIP_COMMENTS, '');
  let argDecl = fnText.match(FN_ARGS);
  let args = argDecl[1].split(FN_ARG_SPLIT);

  args.forEach(arg => arg.replace(FN_ARG, (all, underscore, name) => params.push(name)));

  return params;
}

/**
 * Get Method definition
 * @param service
 * @returns {{type: string, methods: {}}}
 */
export function methodsDefinition(service){

  return innerDef(service);

  function innerDef(prop, parent) {

    // is function
    if (_.isFunction(prop))
      return {
        type: FUNCTIONTYPE,
        params: parameterNames(prop),
        value: prop.bind(parent)
      };

    // is value
    if(isValue(prop))
      return { type: VALUETYPE, value: prop};

    // deeper objects
    let children = Object.create(null);

    // iterate throught all props
    _.forIn(prop, (value, key) => children[key] = innerDef(value, prop));

    return children;
  }
}

/**
 * JSON RPC responder
 * @param methods
 * @returns {*}
 */
export function response(methods){

  var def = methodsDefinition(methods);

  return check(reply);

  // the actual reply
  function reply(req, cb){

    let methodDef = _.get(def, req.method);

    if(req.method === DEFINITIONMETHOD)
      return cb(null, def);

    if(methodDef.type === VALUETYPE)
      return cb(null, methodDef.value);

    try{

      methodDef.value.apply(methodDef.value, getParams(req.params, methodDef.params).concat(cb));

    }catch(err){

      cb(err);
    }
  }

  // extract params
  function getParams(reqParams, defParams){

    if(reqParams === undefined)
      return [];

    if(_.isArray(reqParams))
      return reqParams;

    if(_.isObject(reqParams)){

      return defParams
        .map(name => reqParams[name])
        .filter(p => p !== undefined);
    }
  }

  function check(fn){

    return function(req, cb){

      let err = error(def, req);

      if(err !== undefined)
        return cb(err);

      return fn(req, cb);
    };
  }
}

// error helper function
export function error(def, req){

  if(req.jsonrpc !== JSONRPCVERSION){

    return {
      code: INVALIDREQUEST,
      message: 'The JSONRPC version doesn\'t match 2.0'
    };
  }

  if(req.id === undefined){

    return {
      code: INVALIDREQUEST,
      message: 'The id member is missing'
    };
  }

  if(req.method !== DEFINITIONMETHOD){

    let methodDef = _.get(def, req.method);

    if(methodDef === undefined){

      return {
        code: METHODNOTFOUND,
        message: 'The method was not found'
      };
    }

    if(methodDef.type !== VALUETYPE && methodDef.type !== FUNCTIONTYPE){

      return {
        code: INVALIDREQUEST,
        message: 'The method is not a leaf object'
      };
    }
  }
}


function isValue(prop){

  return _.isBoolean(prop) || _.isNumber(prop) || _.isString(prop) || _.isDate(prop) || _.isArray(prop);
}