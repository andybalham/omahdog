import { Type } from '../omahdog/Type';

export abstract class TemplateReference {
    
    readonly isTemplateReference = true;
    readonly typeName: string;

    constructor(type: Type<TemplateReference>) {
        this.typeName = type.name;
    }
    
    abstract get name(): string | undefined;
    abstract get instance(): any;
    abstract validate(baseTemplate: any): string[];
}

export class ResourceReference extends TemplateReference {
    
    readonly resourceName?: string;
    constructor(resourceName?: string) {
        super(ResourceReference);
        this.resourceName = resourceName;
    }

    get name(): string | undefined { return this.resourceName; }
    get instance(): any { return { 'Ref': this.name }; }

    validate(baseTemplate: any): string[] {
        return (baseTemplate.Resources[this.name ?? 'undefined'] === undefined) 
            ? [ `baseTemplate.Resources[${this.name}] === undefined`] : [];
    }    

    attribute(attributeName: string): ResourceReferenceAttribute {
        return new ResourceReferenceAttribute(this, attributeName);
    }
}

export class ParameterReference extends TemplateReference {
    
    readonly parameterName?: string;
    
    constructor(parameterName?: string) {
        super(ParameterReference);
        this.parameterName = parameterName;
    }
    
    get name(): string | undefined { return this.parameterName; }
    get instance(): any { return { 'Ref': this.name }; }

    validate(baseTemplate: any): string[] {        
        return (baseTemplate.Parameters[this.name ?? 'undefined'] === undefined) 
            ? [ `baseTemplate.Parameters[${this.name}] === undefined`] : [];
    }    
}

export class ResourceReferenceAttribute extends TemplateReference {

    readonly resourceReference?: ResourceReference;
    readonly attributeName?: string;

    constructor(resourceReference?: ResourceReference, attributeName?: string) {
        super(ResourceReferenceAttribute);
        this.resourceReference = resourceReference;
        this.attributeName = attributeName;
    }

    get name(): string | undefined { return `${this.resourceReference?.name}${this.attributeName}`; }
    get instance(): any { return { 'Fn::GetAtt': [ this.resourceReference?.name, this.attributeName] }; }

    validate(baseTemplate: any): string[] {
        return (baseTemplate.Resources[this.resourceReference?.name ?? 'undefined'] === undefined) 
            ? [ `baseTemplate.Resources[${this.resourceReference?.name}] === undefined`] : [];
    }    
}

