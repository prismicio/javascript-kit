(function () {

    "use strict";

    var apiUrl = "https://lesbonneschoses.prismic.io/api",
        apiRef = null;

    // Run some tests
    prismic(apiUrl, fetchProducts);

    function fetchProducts(api) {

        var ref = apiRef || api.data.master,
            productForm = api.forms("products");

        if (productForm) {
            productForm
                .query("[[:d = any(document.type, [\"product\"])]]")
                .ref(ref)
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
