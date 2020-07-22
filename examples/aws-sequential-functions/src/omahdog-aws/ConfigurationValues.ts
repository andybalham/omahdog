import { TemplateReference } from './TemplateReferences';

// TODO 03Jun20: Can we have a value that comes from SSM?
// TODO 20Jun20: Look at https://www.npmjs.com/package/aws-parameter-cache
// TODO 03Jun20: If we do, then we would have to infer the correct policy from it

export interface IConfigurationValue {
    evaluate(): string | undefined;
    validate(baseTemplate: any): string[];
    getTemplateValue(): any;
}

export class EnvironmentVariable implements IConfigurationValue {
    
    readonly value: TemplateReference | string;
    readonly name: string;

    static fromReference(templateReference: TemplateReference, name?: string): EnvironmentVariable {
        return new EnvironmentVariable(templateReference, name ?? EnvironmentVariable.generateVariableName(templateReference));
    }

    static fromConstant(value: string, name: string): EnvironmentVariable {
        return new EnvironmentVariable(value, name);
    }

    private constructor(value: TemplateReference | string, name: string) {
        this.value = value;        
        this.name = name;
    }

    getTemplateValue(): any {
        return (typeof this.value === 'string') ? this.value : this.value.instance;
    }
    
    validate(baseTemplate: any): string[] {        
        return (this.value === undefined) 
            ? ['this.templateReference === undefined'] 
            : (typeof this.value !== 'string') 
                ? this.value.validate(baseTemplate)
                : [];
    }
    
    evaluate(): string | undefined {
        
        const value = (typeof this.value === 'string') ? this.value : process.env[this.name];

        if (value === undefined) {
            console.warn(`process.env[${this.name}] === undefined`);
        }

        return value;
    }

    getEnvironmentVariableDefinition(): any {
        const definition: any = {
            name: this.name,
            value: (typeof this.value === 'string') ? this.value : this.value?.instance
        };
        return definition;
    }

    private static generateVariableName(reference: TemplateReference): string {

        const nameBase = reference.name ?? 'undefined';

        const variableName = 
            nameBase
                .replace(/[^0-9a-zA-Z]/g, '_')
                .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
                .toUpperCase();

        return variableName;
    }
}

export class ConstantValue implements IConfigurationValue {
    private readonly constantValue?: string;
    
    constructor(constantValue?: string) {
        this.constantValue = constantValue;
    }

    getTemplateValue(): any {
        return this.constantValue;
    }
    
    validate(baseTemplate: any): string[] {
        return this.constantValue === undefined ? ['this.constantValue === undefined'] : [];
    }

    evaluate(): string | undefined {
        return this.constantValue;
    }
}

