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
    
    readonly templateReference: TemplateReference;
    readonly variableName: string;

    constructor(templateReference: TemplateReference, variableName?: string) {
        this.templateReference = templateReference;        
        this.variableName = variableName ?? this.generateVariableName(templateReference);
    }

    getTemplateValue(): any {
        return this.templateReference.instance;
    }
    
    validate(baseTemplate: any): string[] {
        return (this.templateReference === undefined) 
            ? ['this.templateReference === undefined'] 
            : this.templateReference.validate(baseTemplate);
    }
    
    evaluate(): string | undefined {
        const value = process.env[this.variableName];
        if (value === undefined) {
            console.warn(`process.env[${this.variableName}] === undefined`);
        }
        return value;
    }

    getEnvironmentVariableDefinition(): any {
        const definition: any = {
            name: this.variableName,
            value: this.templateReference?.instance
        };
        return definition;
    }

    private generateVariableName(templateReference: TemplateReference): string {
        const variableName = templateReference.name?.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
        return variableName ?? 'UNDEFINED';
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

