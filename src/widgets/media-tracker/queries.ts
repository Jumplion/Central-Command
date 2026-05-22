// Named-param queries for media-tracker. Use with namedSql() from
// @renderer/plugins/sqlParams for multi-field INSERT/UPDATE to prevent
// positional-param mistakes. Simple single-param queries stay inline.

export const INSERT_MEDIA_ITEM =
  "INSERT INTO media_items (title,type,status,author_creator,rating,notes,external_id,external_source) VALUES (:title,:type,:status,:author_creator,:rating,:notes,:external_id,:external_source)";

export const UPDATE_MEDIA_ITEM =
  "UPDATE media_items SET title=:title,type=:type,status=:status,author_creator=:author_creator,rating=:rating,notes=:notes,updated_at=:updated_at WHERE id=:id";

export const INSERT_STATUS_HISTORY =
  "INSERT INTO media_status_history (item_id,status,changed_at) VALUES (:item_id,:status,:changed_at)";

export const INSERT_MEDIA_LINK =
  "INSERT OR IGNORE INTO media_links (item_id,linked_item_id,relation) VALUES (:item_id,:linked_item_id,:relation)";
