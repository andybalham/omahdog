import { FunctionNamePrefix } from './LambdaApplication';

export abstract class LambdaBase {
    
    readonly resourceName: string;

    constructor(resourceName: string) {
        this.resourceName = resourceName;
    }

    getRequesterId(functionNamePrefix?: string | FunctionNamePrefix): string {

        const functionName: any = 
            (functionNamePrefix === undefined) 
                ? this.resourceName 
                : (typeof functionNamePrefix === 'string') 
                    ? `${functionNamePrefix}${this.resourceName}`
                    : {
                        'Fn::Sub': `${functionNamePrefix.getTemplate()}${this.resourceName}:Response`
                    };

        return functionName;
    }
}