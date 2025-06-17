// AI Chat Example
//
// Croquet Labs, 2025
//
// This is an example of a simple chat application. It creates a chatroom where users can
// post messages to a shared conversation.

import * as Multisynq from "https://cdn.jsdelivr.net/npm/@multisynq/client@1.0.4/bundled/multisynq-client.esm.js";

//------------------------------------------------------------------------------------------
// ChatModel
//
// Keeps a list of connected users. Assigns a random name to each.
// When a post arrives from one of them, adds it to the chat history along with their name.
//------------------------------------------------------------------------------------------

class ChatModel extends Multisynq.Model {

    init() {
        this.users = {};
        this.history = [];
        this.subscribe("input", "newPost", this.newPost);
        this.subscribe("reset", "chatReset", this.chatReset);
        this.subscribe(this.sessionId, "view-join", this.userJoin);
        this.subscribe(this.sessionId, "view-exit", this.userDrop);
    }

    userJoin({viewId, viewData: {userName}}) {
        this.users[viewId] = userName;
        this.addToHistory(`<i>${userName} has entered the room</i>`);
    }

    userDrop({viewId}) {
        const userName = this.users[viewId];
        delete this.users[viewId];
        this.addToHistory(`<i>${userName} has exited the room</i>`);
   }

    newPost(post) {
        const userName = this.users[post.viewId];
        this.addToHistory(`<b>${userName}:</b> ${this.escape(post.text)}`);
    }

    addToHistory(item){
        this.history.push(item);
        if (this.history.length > 100) this.history.shift();
        this.publish("history", "update", this.history);
    }

    chatReset(viewId) {
        const userName = this.users[viewId];
        this.history = [];
        this.addToHistory(`<i>${userName} has reset the room</i>`);
   }

    escape(text) { // Clean up text to remove html formatting characters
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

}
ChatModel.register("ChatModel");

//------------------------------------------------------------------------------------------
// ChatView
//
// Posts messages, and displays message history.
//------------------------------------------------------------------------------------------

class ChatView extends Multisynq.View {

    constructor(model) {
        super(model);
        const sendButton = document.getElementById("sendButton");
        sendButton.onclick = event => this.onSendClick(event);
        const resetButton = document.getElementById("resetButton");
        resetButton.onclick = event => this.onResetClick(event);
        this.subscribe("history", "update", history => this.refreshHistory(history));
        this.refreshHistory(model.history);
    }

    onSendClick() {
        const textIn = document.getElementById("textIn");
        const post = {viewId: this.viewId, text: textIn.value};
        this.publish("input", "newPost", post);
        textIn.value = "";
    }

    onResetClick() {
        this.publish("reset", "chatReset", this.viewId);
    }

    refreshHistory(history) {
        const textOut = document.getElementById("textOut");
        textOut.innerHTML = "<b>Welcome to Multisynq Chat!</b><br><br>" + history.join("<br>");
        textOut.scrollTop = textOut.scrollHeight;
    }

}



//------------------------------------------------------------------------------------------
// Join the session and spawn our model and view.
//------------------------------------------------------------------------------------------

function randomName() {
    const names =["Acorn","Allspice","Almond","Ancho","Anise","Aoli","Apple","Apricot","Arrowroot","Asparagus","Avocado","Baklava","Balsamic",
        "Banana","Barbecue","Bacon","Basil","Bay Leaf","Bergamot","Blackberry","Blueberry","Broccoli",
        "Buttermilk","Cabbage","Camphor","Canaloupe","Cappuccino","Caramel","Caraway","Cardamom","Catnip","Cauliflower","Cayenne","Celery","Cherry",
        "Chervil","Chives","Chipotle","Chocolate","Coconut","Cookie Dough","Chicory","Chutney","Cilantro","Cinnamon","Clove",
        "Coriander","Cranberry","Croissant","Cucumber","Cupcake","Cumin","Curry","Dandelion","Dill","Durian","Eclair","Eggplant","Espresso","Felafel","Fennel",
        "Fenugreek","Fig","Garlic","Gelato","Gumbo","Honeydew","Hyssop","Ghost Pepper",
        "Ginger","Ginseng","Grapefruit","Habanero","Harissa","Hazelnut","Horseradish","Jalepeno","Juniper","Ketchup","Key Lime","Kiwi","Kohlrabi","Kumquat","Latte",
        "Lavender","Lemon Grass","Lemon Zest","Licorice","Macaron","Mango","Maple Syrup","Marjoram","Marshmallow",
        "Matcha","Mayonnaise","Mint","Mulberry","Mustard","Nectarine","Nutmeg","Olive Oil","Orange Peel","Oregano",
        "Papaya","Paprika","Parsley","Parsnip","Peach","Peanut","Pecan","Pennyroyal","Peppercorn","Persimmon",
        "Pineapple","Pistachio","Plum","Pomegranate","Poppy Seed","Pumpkin","Quince","Ragout","Raspberry","Ratatouille","Rosemary","Rosewater","Saffron","Sage","Sassafras",
        "Sea Salt","Sesame Seed","Shiitake","Sorrel","Soy Sauce","Spearmint","Strawberry","Strudel","Sunflower Seed","Sriracha","Tabasco","Tamarind","Tandoori","Tangerine",
        "Tarragon","Thyme","Tofu","Truffle","Tumeric","Valerian","Vanilla","Vinegar","Wasabi","Walnut","Watercress","Watermelon","Wheatgrass","Yarrow","Yuzu","Zucchini"];
    return names[Math.floor(Math.random() * names.length)];
}

const ThisUser = randomName();

Multisynq.Session.join({
    appId: "io.multisynq.ai-chat",
    apiKey: "234567_Paste_Your_Own_API_Key_Here_7654321",
    model: ChatModel,
    view: ChatView,
    viewData: {
        userName: ThisUser,
    },
    tps: 0, // since there are no future messages, we don't need ticks
});
