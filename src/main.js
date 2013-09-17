(function () {

    "use strict";

    var apiUrl = "https://lesbonneschoses.prismic.io/api",
        api = prismic(apiUrl);

    // Run some tests
    api.get(fetchProducts);

    function fetchProducts() {

        var productForm = api.forms("products");

        if (productForm) {
            productForm
                .ref(api.data.master)
                .submit(displayProducts);
        }
    }

    function displayProducts(products) {

        products.forEach(function (product) {

            var imgs = product.getAllImageViews("image", "main").map(function (img) {
                return img.asHtml()
            }).join();

            var desc = product.get("description");

            var col = product.get("color"),
                flavours = product.getAll("flavour").map(function (fl) {
                    return fl.value;
                }),
                fontCol = col ? col.value : "#000";

            $("<div />")
                .css("color", fontCol)
                .text(product.slugs[0] + " - " + flavours)
                .appendTo("body");

        });

    }

}());
