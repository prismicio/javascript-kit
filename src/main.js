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

			$("<div />")
				.text(product.slugs[0])
				.appendTo("body");

		});

	}

}());
