export abstract class ConfigurationValue {
    abstract get value(): string | undefined;
}

export class EnvironmentVariable extends ConfigurationValue {
    readonly variableName: string;
    readonly templateReference: TemplateReference;

    constructor(variableName: string, resourceReference: TemplateReference) {
        super();
        this.variableName = variableName;
        this.templateReference = resourceReference;
    }
    
    get value(): string | undefined {
        return process.env[this.variableName];
    }
}

export class ConstantValue extends ConfigurationValue {
    private readonly constantValue?: string;
    
    constructor(constantValue?: string) {
        super();
        this.constantValue = constantValue;
    }

    get value(): string | undefined {
        return this.constantValue;
    }
}

export abstract class TemplateReference {
    readonly typeName: string;
    constructor(type: new () => TemplateReference) {
        this.typeName = type.name;
    }
    abstract get instance(): any;
}

export class ResourceReference extends TemplateReference {
    readonly resourceName?: string;
    constructor(resourceName?: string) {
        super(ResourceReference);
        this.resourceName = resourceName;
    }
    get instance(): any { return { 'Ref': this.resourceName }; }
}

export class ParameterReference extends TemplateReference {
    readonly parameterName?: string;
    constructor(parameterName?: string) {
        super(ParameterReference);
        this.parameterName = parameterName;
    }
    get instance(): any { return { 'Ref': this.parameterName }; }
}

export class ResourceAttributeReference extends TemplateReference {
    readonly resourceName?: string;
    readonly attributeName?: string;
    constructor(resourceName?: string, attributeName?: string) {
        super(ResourceAttributeReference);
        this.resourceName = resourceName;
        this.attributeName = attributeName;
    }
    get instance(): any { return { 'Fn:Attr': [ this.resourceName, this.attributeName] }; }
}