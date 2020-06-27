import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { FlowContext, AsyncResponse, IActivityRequestHandlerBase, IActivityRequestHandler, RequestRouter, HandlerFactory } from '../omahdog/FlowContext';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { TemplateReference } from './TemplateReferences';
import { LambdaBase } from './LambdaBase';

export class ApiControllerLambda extends LambdaBase {

    readonly apiGatewayReference: TemplateReference;
    readonly apiControllerRoutesType: new () => ApiControllerRoutes;
    readonly apiControllerRoutes: ApiControllerRoutes;

    constructor(apiGatewayReference: TemplateReference, apiControllerRoutesType: new () => ApiControllerRoutes, initialise?: (lambda: ApiControllerLambda) => void) {

        super(`${apiControllerRoutesType.name}Function`);

        this.apiGatewayReference = apiGatewayReference;
        this.apiControllerRoutesType = apiControllerRoutesType;
        this.apiControllerRoutes = new apiControllerRoutesType;

        console.log(`${ApiControllerLambda.name}.resourceName: ${this.resourceName}`);

        if (initialise !== undefined) {
            initialise(this);            
        }
    }

    getEvents(): any[] {
        
        const events = new Array<any>();

        this.apiControllerRoutes.routeMap.forEach(route => {

            const apiEvent: any = {
                Type: 'Api',
                Properties: {
                    RestApiId: this.apiGatewayReference.instance,
                    Method: route.httpMethod,
                    Path: route.resource
                }
            };
            
            events.push(apiEvent);
        });

        return events;
    }

    async handle(event: APIGatewayProxyEvent, requestRouter: RequestRouter, handlerFactory: HandlerFactory): Promise<APIGatewayProxyResult> {

        console.log(`event: ${JSON.stringify(event)}`);

        // TODO 10Jun20: What validation do we want to do?
        // this.throwErrorIfInvalid();

        const route = this.apiControllerRoutes.getRoute(event);

        // TODO 17May20: Throw a more meaningful error
        if (route === undefined) throw new Error('route === undefined');

        const request = route.getRequest(event.pathParameters, event.queryStringParameters, event.body);

        console.log(`request: ${JSON.stringify(request)}`);

        const flowContext = FlowContext.newContext(requestRouter, handlerFactory);

        const response: any | AsyncResponse | ErrorResponse = await flowContext.handleRequest(route.handlerType, request);

        console.log(`response: ${JSON.stringify(response)}`);

        const apiGatewayProxyResult: APIGatewayProxyResult = this.getAPIGatewayProxyResult(response, route);

        console.log(`apiGatewayProxyResult: ${JSON.stringify(apiGatewayProxyResult)}`);

        return apiGatewayProxyResult;
    }

    private getAPIGatewayProxyResult(response: any, route: ApiControllerRoute): APIGatewayProxyResult {

        let apiGatewayProxyResult: APIGatewayProxyResult;

        if ('AsyncResponse' in response) {
            apiGatewayProxyResult = {
                statusCode: 202,
                body: JSON.stringify({ requestId: response.requestId })
            };
        }
        else if ('ErrorResponse' in response) {
            apiGatewayProxyResult = {
                statusCode: 500,
                body: JSON.stringify(response)
            };
        }
        else if (route.getAPIGatewayProxyResult !== undefined) {
            apiGatewayProxyResult = route.getAPIGatewayProxyResult(response);
        }
        else {
            apiGatewayProxyResult = {
                statusCode: 200,
                body: JSON.stringify(response)
            };
        }

        return apiGatewayProxyResult;
    }
}

export class StringParameters { [name: string]: string }

class ApiControllerRoute {
    httpMethod: string;
    resource: string;
    handlerType: new () => IActivityRequestHandlerBase;
    getRequest: (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null, body: string | null) => any;
    getAPIGatewayProxyResult?: (response: any) => APIGatewayProxyResult
}

export abstract class ApiControllerRoutes {

    readonly routeMap = new Map<string, ApiControllerRoute>();

    constructor(initialise: (routes: ApiControllerRoutes) => void) {
        initialise(this);
    }

    getHandlerTypes(): Array<new () => IActivityRequestHandlerBase> {
        
        const handlerTypes = new Map<string, new () => IActivityRequestHandlerBase>();

        this.routeMap.forEach(route => {
            handlerTypes.set(route.handlerType.name, route.handlerType);
        });

        return Array.from(handlerTypes.values());
    }

    addGet<TReq, TRes, THan extends IActivityRequestHandler<TReq, TRes>>(
        resource: string, requestType: new () => TReq, responseType: new () => TRes, handlerType: new () => THan, 
        getRequest: (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null) => TReq, 
        getAPIGatewayProxyResult?: (response: TRes) => APIGatewayProxyResult): ApiControllerRoutes {

        const route: ApiControllerRoute = {
            httpMethod: 'GET',
            resource: resource,
            handlerType: handlerType,
            getRequest: (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null, body: string | null): any => {
                return getRequest(pathParameters, queryStringParameters);
            },
            getAPIGatewayProxyResult: getAPIGatewayProxyResult        
        };

        this.addRoute(route);

        return this;
    }    

    addPost<TReq, TRes, THan extends IActivityRequestHandler<TReq, TRes>>(
        resource: string, requestType: new () => TReq, responseType: new () => TRes, handlerType: new () => THan, 
        getRequest: (pathParameters: StringParameters | null, body: TReq | null) => TReq, 
        getAPIGatewayProxyResult?: (response: TRes) => APIGatewayProxyResult): ApiControllerRoutes {

        const route: ApiControllerRoute = {
            httpMethod: 'POST',
            resource: resource,
            handlerType: handlerType,
            getRequest: (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null, body: string | null): any => {
                return getRequest(pathParameters, (body === null) ? null : JSON.parse(body));
            },
            getAPIGatewayProxyResult: getAPIGatewayProxyResult        
        };

        this.addRoute(route);

        return this;
    }

    getRoute(event: APIGatewayProxyEvent): ApiControllerRoute | undefined {
        return this.routeMap.get(ApiControllerRoutes.getRouteKey(event.httpMethod, event.resource));
    }

    private addRoute(route: ApiControllerRoute): void {

        const routeKey = ApiControllerRoutes.getRouteKey(route.httpMethod, route.resource);

        if (this.routeMap.has(routeKey)) {
            throw new Error(`Duplicate route key: ${routeKey}`);
        }

        this.routeMap.set(routeKey, route);
    }

    private static getRouteKey(httpMethod: string, resource: string): string {
        return `${httpMethod}:${resource}`;
    }
}
