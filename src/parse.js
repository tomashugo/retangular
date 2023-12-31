'use strict';

var _ = require('lodash');

function Lexer () {

}

AST.Program = 'Program';
AST.Literal = 'Literal';
AST.ArrayExpression = 'ArrayExpression';
AST.ObjectExpression = 'ObjectExpression';
AST.Property = 'Property';
AST.Identifier = 'Identifier';
AST.ThisExpression = 'ThisExpression';

// Init Utilities

Lexer.prototype.isIdentifier = function (ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch === '_' || ch === '$');
};

Lexer.prototype.isNumber = function (ch) {
  return '0' <= ch && ch <= '9';
};

Lexer.prototype.peek = function () {
  return this.index < this.text.length - 1 ? this.text.charAt(this.index + 1) : false;
}

Lexer.prototype.isExpOperator = function (ch) {
  return ch === '-' || ch === '+' || this.isNumber(ch);
}

Lexer.prototype.isWhitespace = function (ch) {
  return ch === ' ' || ch === '\r' || ch === '\t' || ch === '\n' || ch === '\v' || ch === '\u00A0'
}

ASTCompiler.prototype.stringEscapeFn = function (c) {
  return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
};


// End Utilities

// Init Constants


AST.prototype.constants = {
  'null': { type: AST.Literal, value: null },
  'true': { type: AST.Literal, value: true },
  'false': { type: AST.Literal, value: false },
  'this': { type: AST.ThisExpression }
};

ASTCompiler.prototype.stringEscapeRegex = /[^ a-zA-Z0-9]/g;

var ESCAPES = { 'n': '\n', 'f': '\f', 'r': '\r', 't': '\t', 'v': '\v', '\'': '\'', '"': '"' };

// End Constants

Lexer.prototype.readIdentifier = function () {
  var text = '';
  while (this.index < this.text.length) {
    var ch = this.text.charAt(this.index);
    if (this.isIdentifier(ch) || this.isNumber(ch)) {
      text += ch;
    } else {
      break;
    }
    this.index++;
  }

  var token = {
    text: text,
    identifier: true
  };

  this.tokens.push(token);
}

Lexer.prototype.readString = function (quote) {
  this.index++;
  var string = '';
  var escape = false;
  while (this.index < this.text.length) {
    var ch = this.text.charAt(this.index);
    if (escape) {
      if (ch === 'u') {
        var hex = this.text.substring(this.index + 1, this.index + 5);
        if (!hex.match(/[\da-f]{4}/i)) {
          throw 'Invalid unicode escape';
        }
        this.index += 4;
        string += String.fromCharCode(parseInt(hex, 16));
      } else {
        var replacement = ESCAPES[ch];
        if (replacement) {
          string += replacement;
        } else {
          string += ch;
        }
      }
      escape = false;
    } else if (ch === quote) {
      this.index++;
      this.tokens.push({
        text: string,
        value: string
      });
      return;
    } else if (ch === '\\') {
      escape = true;
    } else {
      string += ch;
    }
    this.index++;
  }
  throw 'Unmatched quote';
}

Lexer.prototype.readNumber = function () {
  var number = '';
  while (this.index < this.text.length) {
    var ch = this.text.charAt(this.index).toLowerCase();
    if (this.isNumber(ch) || ch === '.') {
      number += ch;
    }
    else {
      var nextCh = this.peek();
      var prevCh = number.charAt(number.length - 1);
      if (ch === 'e' && this.isExpOperator(nextCh)) {
        number += ch;
      } else if (this.isExpOperator(ch) && prevCh === 'e' && nextCh && this.isNumber(nextCh)) {
        number += ch;
      } else if (this.isExpOperator(ch) && prevCh === 'e' && (!nextCh || !this.isNumber(nextCh))) {
        throw 'Invalid exponent';
      } else {
        break;
      }
    }
    this.index++;
  }

  this.tokens.push({
    text: number,
    value: Number(number)
  });
};

Lexer.prototype.is = function (chs) {
  return chs.indexOf(this.ch) >= 0;
};


Lexer.prototype.lex = function (text) {
  this.text = text;
  this.index = 0;
  this.ch = undefined;
  this.tokens = [];

  while (this.index < this.text.length) {
    this.ch = this.text.charAt(this.index);
    if (this.isNumber(this.ch) || (this.is('.') && this.isNumber(this.peek()))) {
      this.readNumber();
    } else if (this.is('\'"')) {
      this.readString(this.ch);
    } else if (this.is('[],{}:')) {
      this.tokens.push({
        text: this.ch
      });
      this.index++;
    } else if (this.isIdentifier(this.ch)) {
      this.readIdentifier();
    } else if (this.isWhitespace(this.ch)) {
      this.index++;
    } else {
      throw 'Unexpected next character: ' + this.ch;
    }
  }

  return this.tokens;
};

function AST (lexer) {
  this.lexer = lexer;
}

AST.prototype.object = function () {
  var properties = [];
  if (!this.peek('}')) {
    do {
      var property = { type: AST.Property };
      if (this.peek().identifier) {
        property.key = this.identifier();
      } else {
        property.key = this.constant();
      }
      this.consume(':');
      property.value = this.primary();
      properties.push(property);
    } while (this.expect(','))
  }
  this.consume('}');
  return { type: AST.ObjectExpression, properties: properties };
}

AST.prototype.ast = function (text) {
  this.tokens = this.lexer.lex(text);
  return this.program();
};

AST.prototype.program = function () {
  return { type: AST.Program, body: this.primary() };
};

AST.prototype.primary = function () {
  if (this.expect('[')) {
    return this.arrayDeclaration();
  } else if (this.expect('{')) {
    return this.object();
  } else if (this.constants.hasOwnProperty(this.tokens[0].text)) {
    return this.constants[this.consume().text];
  } else if (this.peek().identifier) {
    return this.identifier();
  } else {
    return this.constant();
  }
};

ASTCompiler.prototype.nonComputedMember = function (left, right) {
  return '(' + left + ').' + right;
};

AST.prototype.identifier = function () {
  return { type: AST.Identifier, name: this.consume().text };
};

AST.prototype.constant = function () {
  return { type: AST.Literal, value: this.consume().value };
};

AST.prototype.peek = function (e) {
  if (this.tokens.length > 0) {
    var text = this.tokens[0].text;
    if (text === e || !e) {
      return this.tokens[0];
    }
  }
}


AST.prototype.expect = function (e) {
  var token = this.peek(e);
  if (token) {
    return this.tokens.shift();
  }
};


AST.prototype.consume = function (e) {
  var token = this.expect(e);
  if (!token) {
    throw 'Unexpected. Expecting: ' + e;
  }
  return token;
}

AST.prototype.arrayDeclaration = function () {
  var elements = [];
  if (!this.peek(']')) {
    do {
      if (this.peek(']')) {
        break;
      }
      elements.push(this.primary());
    } while (this.expect(','));
  }
  this.consume(']');
  return { type: AST.ArrayExpression, elements: elements }
};

function ASTCompiler (astBuilder) {
  this.astBuilder = astBuilder;
}

ASTCompiler.prototype.if_ = function (test, consequent) {
  this.state.body.push('if(', test, '){', consequent, '}')
};

ASTCompiler.prototype.assign = function (id, value) {
  return id + '=' + value + ';';
};

ASTCompiler.prototype.recurse = function (ast) {
  switch (ast.type) {
    case AST.Program:
      this.state.body.push('return ', this.recurse(ast.body), ';');
      break;
    case AST.Literal:
      return this.escape(ast.value);
    case AST.ObjectExpression:
      var properties = _.map(ast.properties, _.bind(function (property) {
        var key = property.key.type === AST.Identifier ? property.key.name : this.escape(property.key.value);
        var value = this.recurse(property.value);
        return key + ':' + value;
      }, this));
      return '{' + properties.join(',') + '}';
    case AST.ArrayExpression:
      var elements = _.map(ast.elements, _.bind(function (element) {
        return this.recurse(element)
      }, this))
      return '[' + elements.join(',') + ']';
    case AST.Identifier:
      var intoId = this.nextId();
      this.state.body.push('var ', intoId, ';');
      this.if_('s', this.assign(intoId, this.nonComputedMember('s', ast.name)))
      return intoId;
    case AST.ThisExpression:
      return 's';
  }
}

ASTCompiler.prototype.nextId = function () {
  var id = 'v' + (this.state.nextId++);
  this.state.vars.push(id);
  return id;
};

ASTCompiler.prototype.compile = function (text) {
  var ast = this.astBuilder.ast(text);
  this.state = { body: [], nextId: 0, vars: [] };
  this.recurse(ast);
  return new Function('s',
    (this.state.vars.length ? 'var ' + this.state.vars.join(',') + ';' : '')
    + this.state.body.join(''));
};

ASTCompiler.prototype.escape = function (value) {
  if (_.isString(value)) {
    return '\'' + value.replace(this.stringEscapeRegex, this.stringEscapeFn) + '\'';
  } else if (_.isNull(value)) {
    return 'null'
  } else {
    return value;
  }
}

function Parser (lexer) {
  this.lexer = lexer;
  this.ast = new AST(this.lexer);
  this.astCompiler = new ASTCompiler(this.ast);
}

Parser.prototype.parse = function (text) {
  return this.astCompiler.compile(text);
};

function parse (expr) {
  var lexer = new Lexer();
  var parser = new Parser(lexer);
  return parser.parse(expr);
}

module.exports = parse;