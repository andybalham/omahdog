import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { FlowContext, AsyncResponse, IActivityRequestHandlerBase, IActivityRequestHandler, RequestRouter, HandlerFactory } from '../omahdog/FlowContext';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { Type } from '../omahdog/Type';
import { TemplateReference } from './TemplateReferences';
import { LambdaBase } from './LambdaBase';

export class ApiControllerLambda extends LambdaBase {

    readonly apiGatewayReference: TemplateReference;
    readonly apiControllerRoutesType: Type<ApiControllerRoutes>;
    readonly apiControllerRoutes: ApiControllerRoutes;

    constructor(functionReference: TemplateReference, apiGatewayReference: TemplateReference, apiControllerRoutesType: Type<ApiControllerRoutes>, 
        initialise?: (lambda: ApiControllerLambda) => void) {

        super(functionReference.name ?? 'Undefined');

        this.apiGatewayReference = apiGatewayReference;
        this.apiControllerRoutesType = apiControllerRoutesType;
        this.apiControllerRoutes = new apiControllerRoutesType;

        if (initialise !== undefined) {
            initialise(this);            
        }
    }

    // TODO 28Jun20: What should happen to asynchronous responses? Only the caller knows the requestId. We might want to invoke a webhook or similar.

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

    private getAPIGatewayProxyResult(response: any, route: ApiControllerRouteBase): APIGatewayProxyResult {

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

// TODO 28Jun20: Add a method to the route to validate the request and return BadRequest

export abstract class ApiControllerRouteBase {
    httpMethod: string;
    resource: string;
    handlerType: Type<IActivityRequestHandlerBase>;
    getRequest: (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null, body: string | null) => any;
    getAPIGatewayProxyResult?: (response: any) => APIGatewayProxyResult
}

export class ApiControllerRoute<TReq, TRes> extends ApiControllerRouteBase {
    httpMethod: string;
    resource: string;
    handlerType: Type<IActivityRequestHandler<TReq, TRes>>;
    getRequest: (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null, body: string | null) => TReq;
    getAPIGatewayProxyResult?: (response: TRes) => APIGatewayProxyResult
}

export abstract class ApiControllerRoutes {

    readonly routeMap = new Map<string, ApiControllerRouteBase>();

    constructor(initialise: (routes: ApiControllerRoutes) => void) {
        initialise(this);
    }

    getHandlerTypes(): Array<Type<IActivityRequestHandlerBase>> {
        
        const handlerTypes = new Map<string, Type<IActivityRequestHandlerBase>>();

        this.routeMap.forEach(route => {
            handlerTypes.set(route.handlerType.name, route.handlerType);
        });

        return Array.from(handlerTypes.values());
    }

    addGet<TReq, TRes, THan extends IActivityRequestHandler<TReq, TRes>>(
        resource: string, requestType: Type<TReq>, responseType: Type<TRes>, handlerType: Type<THan>,  
        initialiseRoute?: (route: ApiControllerRoute<TReq, TRes>) => void): ApiControllerRoutes {

        const route: ApiControllerRoute<TReq, TRes> = {
            httpMethod: 'GET',
            resource: resource,
            handlerType: handlerType,
            getRequest: (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null, body: string | null): any => {
                return new requestType;
            }
        };

        if (initialiseRoute !== undefined) {
            initialiseRoute(route);
        }

        this.addRoute(route);

        return this;
    }    

    addPost<TReq, TRes, THan extends IActivityRequestHandler<TReq, TRes>>(
        resource: string, requestType: Type<TReq>, responseType: Type<TRes>, handlerType: Type<THan>, 
        initialiseRoute?: (route: ApiControllerRoute<TReq, TRes>) => void): ApiControllerRoutes {

        const route: ApiControllerRoute<TReq, TRes> = {
            httpMethod: 'POST',
            resource: resource,
            handlerType: handlerType,
            getRequest: (pathParameters: StringParameters | null, queryStringParameters: StringParameters | null, body: string | null): any => {
                return (body === null) ? new requestType : JSON.parse(body);
            }
        };

        if (initialiseRoute !== undefined) {
            initialiseRoute(route);
        }

        this.addRoute(route);

        return this;
    }

    getRoute(event: APIGatewayProxyEvent): ApiControllerRouteBase | undefined {
        return this.routeMap.get(ApiControllerRoutes.getRouteKey(event.httpMethod, event.resource));
    }

    private addRoute(route: ApiControllerRouteBase): void {

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
