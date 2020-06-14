class Service1 {}
class Service1Extension extends Service1 {}
class Service2 {}

abstract class ActivityBase {
    services = {
        baseService: new Service1
    }
}

class ActivityImplementation extends ActivityBase {
    services = {
        baseService: new Service1Extension,
        implementationService: new Service2
    }
}

describe('Inheritance tests', () => {

    it('sub-class contains both properties', () => {
        
        const activity = new ActivityImplementation;

        for (const serviceName in activity.services) {
            const service = (activity.services as any)[serviceName];
            console.log(JSON.stringify(service));
        }
    });    
});