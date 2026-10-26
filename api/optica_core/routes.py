from flask import Blueprint, abort, jsonify, render_template, request, send_from_directory
from flask_cors import cross_origin

from optica_core.dataset import Dataset


def create_blueprint(dataset: Dataset, site_data: dict) -> Blueprint:
    """Routes shared by every Optica backend."""
    bp = Blueprint("optica_core", __name__)

    # landing page
    @bp.route("/<id>")
    def welcome(id):
        return render_template("index.html", **site_data)

    # send full image
    @bp.route("/<id>/<image_id>/full-image")
    @cross_origin()
    def image(id, image_id):
        return send_from_directory(*dataset.full_image(id, image_id))

    # send thumbnail
    @bp.route("/<id>/<image_id>/thumbnail")
    @cross_origin()
    def thumbnail(id, image_id):
        return send_from_directory(*dataset.thumbnail(id, image_id))

    # send project data
    @bp.route("/<id>/images")
    @cross_origin()
    def images(id):
        return jsonify(dataset.images(id))

    # compute the position of a landmark,
    # /<id>/position is kept for the clients that don't send the image
    @bp.route("/<id>/<image_id>/position")
    @bp.route("/<id>/position", defaults={"image_id": None})
    @cross_origin()
    def position(id, image_id):
        try:
            x = float(request.args["x"])
            y = float(request.args["y"])
        except (KeyError, ValueError):
            abort(400)
        try:
            return jsonify(dataset.position(id, image_id, x, y))
        except NotImplementedError:
            abort(404)

    return bp
