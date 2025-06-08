import { Project, Node, ts } from "ts-morph";
import { Result, ok, err } from "neverthrow";

export interface GetTypeSignatureRequest {
  moduleName: string;
  typeName: string;
  filePath?: string; // Optional context file for resolving relative imports
}

export interface TypeSignature {
  kind: "function" | "class" | "interface" | "type" | "variable";
  // For functions
  functionSignatures?: FunctionSignature[];
  // For types/interfaces/classes
  typeDefinition?: string;
  properties?: PropertyInfo[];
  methods?: MethodInfo[];
  // Common
  typeParameters?: string[];
}

export interface FunctionSignature {
  parameters: ParameterInfo[];
  returnType: string;
  typeParameters?: string[];
}

export interface PropertyInfo {
  name: string;
  type: string;
  optional: boolean;
  readonly: boolean;
}

export interface MethodInfo {
  name: string;
  signatures: FunctionSignature[];
}

export interface ParameterInfo {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

export interface GetTypeSignatureSuccess {
  message: string;
  typeName: string;
  signature: TypeSignature;
  documentation?: string;
}

/**
 * Helper function to simplify type names by removing import paths
 */
function simplifyTypeName(typeName: string): string {
  // Remove import("...") wrapper and get just the type name
  return typeName.replace(/import\("[^"]+"\)\./g, '');
}

/**
 * Extract function signatures
 */
function extractFunctionSignatures(type: Node["getType"]["prototype"], contextNode: Node): FunctionSignature[] {
  const signatures: FunctionSignature[] = [];
  const callSignatures = type.getCallSignatures();
  
  for (const sig of callSignatures) {
    // Get parameters
    const parameters: ParameterInfo[] = sig.getParameters().map((param: any) => {
      const paramDeclarations = param.getDeclarations();
      
      let isOptional = false;
      let defaultValue: string | undefined;
      let paramTypeText = "unknown";
      
      // Check if parameter declaration has optional or default value
      if (paramDeclarations && paramDeclarations.length > 0) {
        const firstDecl = paramDeclarations[0];
        if (Node.isParameterDeclaration(firstDecl)) {
          const paramDecl = firstDecl;
          isOptional = paramDecl.hasQuestionToken() || paramDecl.hasInitializer();
          
          const initializer = paramDecl.getInitializer();
          if (initializer) {
            defaultValue = initializer.getText();
          }
          
          // Get type from parameter
          const typeNode = paramDecl.getTypeNode();
          if (typeNode) {
            paramTypeText = typeNode.getText();
          } else {
            paramTypeText = paramDecl.getType().getText();
          }
        } else {
          // For non-parameter declarations, use the declaration's type
          const declType = firstDecl.getType();
          paramTypeText = declType.getText();
        }
      } else {
        // Fallback to checking symbol flags
        const symbol = param.compilerSymbol;
        isOptional = (symbol.flags & ts.SymbolFlags.Optional) !== 0;
        
        // Try to get type text from the type checker
        const paramType = param.getTypeAtLocation(contextNode);
        paramTypeText = paramType.getText();
      }
      
      return {
        name: param.getName(),
        type: simplifyTypeName(paramTypeText),
        optional: isOptional,
        defaultValue
      };
    });
    
    // Get return type
    const returnType = sig.getReturnType();
    
    // Get type parameters
    const typeParams = sig.getTypeParameters();
    const typeParamStrings = typeParams && typeParams.length > 0 
      ? typeParams.map((t: any) => {
          const constraint = t.getConstraint();
          if (constraint) {
            const symbol = t.getSymbol();
            const name = symbol ? symbol.getName() : 'T';
            return `${name} extends ${simplifyTypeName(constraint.getText())}`;
          }
          const symbol = t.getSymbol();
          return symbol ? symbol.getName() : 'T';
        })
      : undefined;
    
    signatures.push({
      parameters,
      returnType: simplifyTypeName(returnType.getText()),
      typeParameters: typeParamStrings
    });
  }
  
  return signatures;
}

/**
 * Extract properties from a type
 */
function extractProperties(type: Node["getType"]["prototype"], contextNode: Node): PropertyInfo[] {
  const properties: PropertyInfo[] = [];
  const allProperties = type.getProperties();
  
  for (const prop of allProperties) {
    const propName = prop.getName();
    
    // Skip private properties and constructor
    if (propName.startsWith("_") || propName.startsWith("#") || propName === "constructor") continue;
    
    const propDeclarations = prop.getDeclarations();
    if (!propDeclarations || propDeclarations.length === 0) {
      // For interfaces and types, we might not have declarations
      // Try to get the type directly
      const propType = prop.getTypeAtLocation(contextNode);
      const callSignatures = propType.getCallSignatures();
      
      // Skip if it's a method
      if (callSignatures.length > 0) continue;
      
      const isOptional = (prop.compilerSymbol.flags & ts.SymbolFlags.Optional) !== 0;
      
      properties.push({
        name: propName,
        type: simplifyTypeName(propType.getText()),
        optional: isOptional,
        readonly: false
      });
      continue;
    }
    
    const firstDecl = propDeclarations[0];
    const propType = prop.getTypeAtLocation(firstDecl);
    const callSignatures = propType.getCallSignatures();
    
    // Skip if it's a method
    if (callSignatures.length > 0) continue;
    
    const isOptional = (prop.compilerSymbol.flags & ts.SymbolFlags.Optional) !== 0;
    const isReadonly = false; // ts-morph doesn't expose readonly flag easily
    
    properties.push({
      name: propName,
      type: simplifyTypeName(propType.getText()),
      optional: isOptional,
      readonly: isReadonly
    });
  }
  
  return properties;
}

/**
 * Extract methods from a type
 */
function extractMethods(type: Node["getType"]["prototype"], contextNode: Node): MethodInfo[] {
  const methods: MethodInfo[] = [];
  const allProperties = type.getProperties();
  
  for (const prop of allProperties) {
    const propName = prop.getName();
    
    // Skip private properties and constructor
    if (propName.startsWith("_") || propName.startsWith("#") || propName === "constructor") continue;
    
    const propDeclarations = prop.getDeclarations();
    let propType;
    let nodeForSignature = contextNode;
    
    if (!propDeclarations || propDeclarations.length === 0) {
      // For interfaces and types, we might not have declarations
      propType = prop.getTypeAtLocation(contextNode);
    } else {
      const firstDecl = propDeclarations[0];
      propType = prop.getTypeAtLocation(firstDecl);
      nodeForSignature = firstDecl;
    }
    
    const callSignatures = propType.getCallSignatures();
    
    // Only include if it's a method
    if (callSignatures.length > 0) {
      const signatures = extractFunctionSignatures(propType, nodeForSignature);
      methods.push({
        name: propName,
        signatures
      });
    }
  }
  
  return methods;
}

/**
 * Get detailed signature information for a specific type (function, class, interface, type alias, etc.)
 */
export function getTypeSignature(
  project: Project,
  request: GetTypeSignatureRequest
): Result<GetTypeSignatureSuccess, string> {
  try {
    // Create a temporary source file that imports the module
    const importPath = `import { ${request.typeName} } from "${request.moduleName}";`;
    
    const tempFileName = request.filePath ? 
      request.filePath.replace(/\.[^.]+$/, '_temp_type_analysis.ts') :
      'temp_type_analysis.ts';
    
    let sourceFile;
    try {
      sourceFile = project.createSourceFile(
        tempFileName,
        importPath,
        { overwrite: true }
      );
    } catch (error) {
      return err(`Failed to create source file: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Get the import declaration
    const importDecl = sourceFile.getImportDeclaration(request.moduleName);
    if (!importDecl) {
      sourceFile.delete();
      return err(`Failed to import module: ${request.moduleName}`);
    }
    
    // Get the named import
    const namedImports = importDecl.getNamedImports();
    const typeImport = namedImports.find(i => i.getName() === request.typeName);
    
    if (!typeImport) {
      sourceFile.delete();
      return err(`Type "${request.typeName}" not found in module "${request.moduleName}"`);
    }
    
    const symbol = typeImport.getSymbol();
    if (!symbol) {
      sourceFile.delete();
      return err(`Failed to get symbol for type: ${request.typeName}`);
    }
    
    const actualSymbol = symbol.getAliasedSymbol() || symbol;
    
    // Get the declarations
    const declarations = actualSymbol.getDeclarations();
    if (declarations.length === 0) {
      sourceFile.delete();
      return err(`No declarations found for type: ${request.typeName}`);
    }
    
    const firstDecl = declarations[0];
    const type = actualSymbol.getTypeAtLocation(firstDecl);
    
    // Determine the kind and extract appropriate information
    let signature: TypeSignature;
    
    // Check if it's a function
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length > 0 && !Node.isClassDeclaration(firstDecl) && !Node.isInterfaceDeclaration(firstDecl)) {
      // It's a function or function-like
      signature = {
        kind: "function",
        functionSignatures: extractFunctionSignatures(type, firstDecl)
      };
    }
    // Check if it's a class
    else if (Node.isClassDeclaration(firstDecl)) {
      const typeParams = firstDecl.getTypeParameters();
      const typeParamStrings = typeParams.length > 0
        ? typeParams.map(p => {
            const constraint = p.getConstraint();
            return constraint 
              ? `${p.getName()} extends ${simplifyTypeName(constraint.getText())}`
              : p.getName();
          })
        : undefined;
      
      // For classes, get the instance type
      let instanceType = type;
      // If we have a constructor type, get the instance type
      const constructSignatures = type.getConstructSignatures();
      if (constructSignatures.length > 0) {
        instanceType = constructSignatures[0].getReturnType();
      }
      
      signature = {
        kind: "class",
        properties: extractProperties(instanceType, firstDecl),
        methods: extractMethods(instanceType, firstDecl),
        typeParameters: typeParamStrings
      };
    }
    // Check if it's an interface
    else if (Node.isInterfaceDeclaration(firstDecl)) {
      const typeParams = firstDecl.getTypeParameters();
      const typeParamStrings = typeParams.length > 0
        ? typeParams.map(p => {
            const constraint = p.getConstraint();
            return constraint 
              ? `${p.getName()} extends ${simplifyTypeName(constraint.getText())}`
              : p.getName();
          })
        : undefined;
      
      // For interfaces, use the declaration's type directly
      const interfaceType = firstDecl.getType();
      
      signature = {
        kind: "interface",
        properties: extractProperties(interfaceType, firstDecl),
        methods: extractMethods(interfaceType, firstDecl),
        typeParameters: typeParamStrings
      };
    }
    // Check if it's a type alias
    else if (Node.isTypeAliasDeclaration(firstDecl)) {
      const typeParams = firstDecl.getTypeParameters();
      const typeParamStrings = typeParams.length > 0
        ? typeParams.map(p => {
            const constraint = p.getConstraint();
            return constraint 
              ? `${p.getName()} extends ${simplifyTypeName(constraint.getText())}`
              : p.getName();
          })
        : undefined;
      
      signature = {
        kind: "type",
        typeDefinition: simplifyTypeName(firstDecl.getType().getText()),
        typeParameters: typeParamStrings
      };
    }
    // Otherwise it's a variable
    else {
      signature = {
        kind: "variable",
        typeDefinition: simplifyTypeName(type.getText())
      };
    }
    
    // Get documentation
    const jsDocs = actualSymbol.getJsDocTags();
    const documentation = jsDocs.length > 0
      ? jsDocs.map(tag => `@${tag.getName()} ${tag.getText()}`).join('\n')
      : undefined;
    
    // Clean up temporary file
    sourceFile.delete();
    
    return ok({
      message: `Found signature for ${signature.kind} "${request.typeName}"`,
      typeName: request.typeName,
      signature,
      documentation
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}