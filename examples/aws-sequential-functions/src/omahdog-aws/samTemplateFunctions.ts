import { RequestRouter, HandlerFactory } from '../omahdog/FlowContext';

export function validateConfiguration(targetObject: any, baseTemplate: any, requestRouter: RequestRouter, handlerFactory: HandlerFactory, errorPrefix = ''): string[] {
        
    let errorMessages: string[] = [];

    if (targetObject === undefined) {
        return errorMessages;
    }

    const targetObjectErrorMessages: string[] = 
        safeInvoke(targetObject, 'validate', baseTemplate, requestRouter, handlerFactory) ?? [];

    errorMessages = 
        errorMessages.concat(
            targetObjectErrorMessages.map(errorMessage => `${errorPrefix}: ${errorMessage}`));

    const addConfigurationErrors = 
        (configObject: any, errorPrefix: string, errorMessages: string[]): string[] => {

            for (const configProperty in configObject ?? {}) {
                
                const config = configObject[configProperty];
                const configErrorPrefix = `${errorPrefix}.${configProperty}`;
                const configErrorMessages = validateConfiguration(config, baseTemplate, requestRouter, handlerFactory, configErrorPrefix);
        
                errorMessages = errorMessages.concat(configErrorMessages);
            }
        
            return errorMessages;
        };
        
    errorMessages = addConfigurationErrors(targetObject.parameters, errorPrefix, errorMessages);
    errorMessages = addConfigurationErrors(targetObject.services, errorPrefix, errorMessages);

    return errorMessages;
}

export function getRequiredPolicies(targetObject: any): any[] {
        
    let policies: any[] = [];

    if (targetObject === undefined) {
        return policies;
    }

    const targetObjectPolicies = safeInvoke(targetObject, 'getPolicies') ?? [];
    
    policies = policies.concat(targetObjectPolicies);

    const addPolicies = 
        (configObject: any, policies: any[]): any[] => {

            for (const configProperty in configObject ?? {}) {            
                const configPolicies = getRequiredPolicies(configObject[configProperty]);
                policies = policies.concat(configPolicies);
            }
        
            return policies;
        };
        
    policies = addPolicies(targetObject.parameters, policies);
    policies = addPolicies(targetObject.services, policies);

    return policies;
}

export function safeInvoke(target: any, methodName: string, ...parameters: any[]): any {
    return (methodName in target) ? target[methodName](...parameters) : undefined;
}

export function getEnvironmentVariables(targetObject: any): any[] {
        
    let environmentVariables: any[] = [];

    if (targetObject === undefined) {
        return environmentVariables;
    }

    for (const parameterName in targetObject.parameters ?? {}) {
        
        const parameter = targetObject.parameters[parameterName];
        
        const parameterEnvironmentVariables = safeInvoke(parameter, 'getEnvironmentVariableDefinition');

        if (parameterEnvironmentVariables !== undefined) 
            environmentVariables.push(parameterEnvironmentVariables);
    }            

    for (const serviceName in targetObject.services ?? {}) {
        const service = targetObject.services[serviceName];
        const serviceEnvironmentVariables = getEnvironmentVariables(service);        
        environmentVariables = environmentVariables.concat(serviceEnvironmentVariables);
    }

    return environmentVariables;
}

export function getEvents(targetObject: any, requesterId?: any): any[] {
        
    let events: any[] = [];

    if (targetObject === undefined) {
        return events;
    }

    if (targetObject !== undefined) {

        const targetObjectEvents = safeInvoke(targetObject, 'getEvents', requesterId) ?? [];

        events = events.concat(targetObjectEvents);
        
        for (const serviceName in targetObject.services ?? {}) {
            const service = targetObject.services[serviceName];
            const serviceEvents = getEvents(service, requesterId);
            events = events.concat(serviceEvents);
        }    
    }

    return events;
}