@IsTest
private class GreetingServiceTest {
    @IsTest static void greetsByName() {
        System.assertEquals('Hello, Ava', GreetingService.greet('Ava'));
    }
    @IsTest static void greetsFriendWhenBlank() {
        System.assertEquals('Hello, friend', GreetingService.greet(''));
    }
}
