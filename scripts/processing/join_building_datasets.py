import geopandas as gpd
import pandas as pd
import json
import os
from datetime import datetime

def load_config(config_path):
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"The configuration file does not exist at the path: {config_path}")
    
    with open(config_path) as file:
        return json.load(file)

def standardize_date(date_str):
    if pd.isna(date_str):
        return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%dT%H:%M:%S').date().isoformat()
    except ValueError:
        try:
            return datetime.strptime(date_str, '%d.%m.%Y').date().isoformat()
        except ValueError:
            raise ValueError(f"Date format for {date_str} not recognized.")

def read_and_select(building_path, column_mapping, purpose_mapping=None):
    buildings = gpd.read_file(building_path)
    buildings_selected = buildings[list(column_mapping.keys())].copy()
    buildings_selected.rename(columns=column_mapping, inplace=True)
    buildings_selected['completion_date'] = buildings_selected['completion_date'].apply(standardize_date)
    if purpose_mapping and 'purpose_of_use' in buildings_selected:
        buildings_selected['purpose_of_use'] = buildings_selected['purpose_of_use'].map(purpose_mapping)
    return buildings_selected

def apply_grouping(data, grouping_config):
    def get_group(purpose):
        for group, purposes in grouping_config.items():
            if purpose in purposes:
                return group
        return "Other"
    data['grouped_purpose_of_use'] = data['purpose_of_use'].apply(get_group)
    return data

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
config_path = os.path.join(base_dir, 'data', 'util', 'RA-KAYTTARK-HEL.json')
grouping_config_path = os.path.join(base_dir, 'data', 'util', 'purpose-of-use-groupings-hel-espoo.json')
espoo_buildings_path = os.path.join(base_dir, 'data', 'raw', 'espoo-rakennukset-16-11-2023.geojson')
helsinki_buildings_path = os.path.join(base_dir, 'data', 'raw', 'helsinki-rakennukset_alue_rekisteritiedot-16-11-2023.geojson')
output_path = os.path.join(base_dir, 'data', 'raw', 'helsinki-espoo-buildings-joined-16-11-2023.geojson')

purpose_mapping = load_config(config_path)["RA_KAYTTARK"]
grouping_config = load_config(grouping_config_path) 

helsinki_column_mapping = {
    'vtj_prt': 'permanent_building_identifier', 'i_kokala': 'total_area', 
    'i_kerrosala': 'floor_area', 'i_raktilav': 'volume', 'i_kerrlkm': 'number_of_floors', 
    'i_huoneistojen_lkm': 'number_of_dwellings', 'c_valmpvm': 'completion_date', 
    'c_kayttark': 'purpose_of_use', 'geometry': 'geometry'
}

espoo_column_mapping = {
    'PYSYVARAKENNUSTUNNUS': 'permanent_building_identifier', 'KOKONAISALA': 'total_area', 
    'KERROSALA': 'floor_area', 'TILAVUUS': 'volume', 'KERROSLUKU': 'number_of_floors', 
    'ASUNNOT': 'number_of_dwellings', 'VALMISTUNUT': 'completion_date', 
    'KAYTTOTARKOITUS': 'purpose_of_use', 'geometry': 'geometry'
}

helsinki_selected = read_and_select(helsinki_buildings_path, helsinki_column_mapping, purpose_mapping)
espoo_selected = read_and_select(espoo_buildings_path, espoo_column_mapping)

combined_buildings = pd.concat([helsinki_selected, espoo_selected], ignore_index=True)
combined_buildings.dropna(subset=['permanent_building_identifier'], inplace=True)
combined_buildings = combined_buildings[combined_buildings['geometry'].geom_type == 'Polygon']

combined_buildings = apply_grouping(combined_buildings, grouping_config)

combined_buildings.to_file(output_path, driver="GeoJSON")
print(f"Combined dataset saved as {output_path}")