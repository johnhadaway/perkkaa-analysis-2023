import geopandas as gpd
import json
import os

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
data_path = os.path.join(base_dir, 'data', 'raw', 'espoo-autoliikennemaarat-21-11-2023.geojson')
output_path = os.path.join(base_dir, 'data', 'processed', 'espoo-autoliikennemaarat-21-11-2023-min.geojson')

data = gpd.read_file(data_path)

columns_fi = ['Viimeisin_laskentavuosi', 'Yöliikenteen_määrä_pros', 'Iltahuipputunnin_määrä_pros', 'Aamuhuipputunnin_määrä_pros', 'Liikennemäärä_KAVL_2019', 'Raskaanliikenteen_määrä_pros', 'Liikennemäärä_KAVL_2020', 'Liikennemäärä_KAVL_2021', 'Liikennemäärä_KAVL_2022', 'Nimi', 'Liikennemäärä_KAVL_2018', 'geometry']
columns_en = ['latest_year', 'per_night_traffic', 'per_evening_rush_hour_traffic', 'per_morning_rush_hour_traffic', 'traffic_amount_2019', 'heavy_traffic', 'traffic_amount_2020', 'traffic_amount_2021', 'traffic_amount_2022', 'name', 'traffic_amount_2018', 'geometry']

data = data[columns_fi]
data.columns = columns_en

data = data[['name', 'geometry', 'traffic_amount_2018', 'traffic_amount_2019', 'traffic_amount_2020', 'traffic_amount_2021', 'traffic_amount_2022', 'per_night_traffic', 'per_evening_rush_hour_traffic', 'per_morning_rush_hour_traffic']]
data = data.to_crs(epsg=4326)
data = data[data.geometry.type == 'LineString']

data.to_file(output_path, driver='GeoJSON')