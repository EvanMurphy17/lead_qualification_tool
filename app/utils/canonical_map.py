from typing import Dict, Any

CANONICAL_MAP: Dict[str, Dict[str, Any]] = {
  "Building Name": {
    "Boston": {"type": "column", "name": "Property Owner Name"},
    "California": {"type": "column", "name": "Property Name"},
    "Chicago": {"type": "column", "name": "Property Name"},
    "Denver": {"type": "column", "name": "Property_Name"},
    "Montgomery County": {"type": "column", "name": "Building Name"},
    "New York City": {"type": "column", "name": "Property Name"},
    "Philadelphia": {"type": "column", "name": "property_name"},
    "Seattle": {"type": "column", "name": "BuildingName"},
    "Washington DC": {"type": "column", "name": "PROPERTYNAME"}
  },

  "Street Address": {
    "Boston": {"type": "column", "name": "Building Address"},
    "California": {"type": "column", "name": "Address 1"},
    "Chicago": {"type": "column", "name": "Address"},
    "Denver": {"type": "column", "name": "Street"},
    "Montgomery County": {"type": "column", "name": "Address"},
    "New York City": {"type": "column", "name": "Address 1"},
    "Philadelphia": {"type": "column", "name": "street_address"},
    "Seattle": {"type": "column", "name": "Address"},
    "Washington DC": {"type": "column", "name": "REPORTEDADDRESS"}
  },

  "City": {
    "Boston": {"type": "column", "name": "Building Address City"},
    "California": {"type": "column", "name": "City"},
    "Chicago": {"type": "literal", "value": "Chicago"},
    "Denver": {"type": "literal", "value": "Denver"},
    "Montgomery County": {"type": "column", "name": "City"},
    "New York City": {"type": "column", "name": "City"},
    "Philadelphia": {"type": "literal", "value": "Philadelphia"},
    "Seattle": {"type": "column", "name": "City"},
    "Washington DC": {"type": "column", "name": "CITY"}
  },

  "State": {
    "Boston": {"type": "literal", "value": "Massachusetts"},
    "California": {"type": "column", "name": "State/Province"},
    "Chicago": {"type": "literal", "value": "Illinois"},
    "Denver": {"type": "literal", "value": "Colorado"},
    "Montgomery County": {"type": "column", "name": "State"},
    "New York City": {"type": "literal", "value": "New York"},
    "Philadelphia": {"type": "literal", "value": "Pennsylvania"},
    "Seattle": {"type": "column", "name": "State"},
    "Washington DC": {"type": "column", "name": "STATE"}
  },

  "Zip Code": {
    "Boston": {"type": "column", "name": "Building Address Zip  Code"},
    "California": {"type": "column", "name": "Postal Code"},
    "Chicago": {"type": "column", "name": "ZIP Code"},
    "Denver": {"type": "column", "name": "Zipcode"},
    "Montgomery County": {"type": "column", "name": "Zip"},
    "New York City": {"type": "column", "name": "Postal Code"},
    "Philadelphia": {"type": "column", "name": "postal_code"},
    "Seattle": {"type": "column", "name": "ZipCode"},
    "Washington DC": {"type": "column", "name": "POSTALCODE"}
  },

  "Floor Area (sq ft)": {
    "Boston": {"type": "column", "name": "Reported Gross Floor Area (Sq Ft)"},
    "California": {"type": "column", "name": "Property GFA - Calculated (Buildings) (ft²)"},
    "Chicago": {"type": "column", "name": "Gross Floor Area - Buildings (sq ft)"},
    "Denver": {"type": "column", "name": "Master_Sq_Ft"},
    "Montgomery County": {"type": "column", "name": "Reported Property Gross Floor Area"},
    "New York City": {"type": "column", "name": "Largest Property Use Type - Gross Floor Area (ft²)"},
    "Philadelphia": {"type": "column", "name": "total_floor_area_bld_pk_ft2"},
    "Seattle": {"type": "column", "name": "PropertyGFATotal"},
    "Washington DC": {"type": "column", "name": "REPORTEDBUILDINGGROSSFLOORAREA"}
  },

  "Property Type": {
    "Boston": {"type": "column", "name": "Largest Property Type"},
    "California": {"type": "column", "name": "Primary Property Type - Portfolio Manager-Calculated"},
    "Chicago": {"type": "column", "name": "Primary Property Type"},
    "Denver": {"type": "column", "name": "Master_Property_Type"},
    "Montgomery County": {"type": "column", "name": "Primary Property Type Self Selected"},
    "New York City": {"type": "column", "name": "Primary Property Type - Self Selected"},
    "Philadelphia": {"type": "column", "name": "primary_prop_type_epa_calc"},
    "Seattle": {"type": "column", "name": "BuildingType"},
    "Washington DC": {"type": "column", "name": "PRIMARYPROPERTYTYPE_SELFSELECT"}
  },

  "Natural Gas Usage": {
    "Boston": {"type": "column", "name": "Natural Gas Usage (kBtu)"},
    "California": {"type": "column", "name": "Natural Gas Use (kBtu)"},
    "Chicago": {"type": "column", "name": "Natural Gas Use (kBtu)"},
    "Denver": {"type": "column", "name": "Natural_Gas_Use__kBtu_"},
    "Montgomery County": {"type": "column", "name": "Natural Gas (therms)"},
    "New York City": {"type": "column", "name": "Natural Gas Use (kBtu)"},
    "Philadelphia": {"type": "column", "name": "natural_gas_use_kbtu"},
    "Seattle": {"type": "column", "name": "NaturalGas(kBtu)"},
    "Washington DC": {"type": "column", "name": "NATURALGASUSE_THERMS"}
  },

  "Natural Gas Usage Units": {
    "Boston": {"type": "literal", "value": "kBtu"},
    "California": {"type": "literal", "value": "kBtu"},
    "Chicago": {"type": "literal", "value": "kBtu"},
    "Denver": {"type": "literal", "value": "kBtu"},
    "Montgomery County": {"type": "literal", "value": "therms"},
    "New York City": {"type": "literal", "value": "kBtu"},
    "Philadelphia": {"type": "literal", "value": "kBtu"},
    "Seattle": {"type": "literal", "value": "kBtu"},
    "Washington DC": {"type": "literal", "value": "therms"}
  },

  "Electricity Usage": {
    "Boston": {"type": "column", "name": "Electricity Usage (kWh)"},
    "California": {"type": "column", "name": "Electricity Use - Grid Purchase (kBtu)"},
    "Chicago": {"type": "column", "name": "Electricity Use (kBtu)"},
    "Denver": {"type": "column", "name": "Electricity_Use_Grid_Purchase__"},
    "Montgomery County": {"type": "column", "name": "Electricity (kWh)"},
    "New York City": {"type": "column", "name": "Electricity Use - Grid Purchase (kWh)"},
    "Philadelphia": {"type": "column", "name": "electric_use_kbtu"},
    "Seattle": {"type": "column", "name": "Electricity(kWh)"},
    "Washington DC": {"type": "column", "name": "ELECTRICITYUSE_GRID_KWH"}
  },

  "Electricity Usage Units": {
    "Boston": {"type": "literal", "value": "kWh"},
    "California": {"type": "literal", "value": "kBtu"},
    "Chicago": {"type": "literal", "value": "kBtu"},
    "Denver": {"type": "literal", "value": "kWh"},
    "Montgomery County": {"type": "literal", "value": "kWh"},
    "New York City": {"type": "literal", "value": "kWh"},
    "Philadelphia": {"type": "literal", "value": "kBtu"},
    "Seattle": {"type": "literal", "value": "kWh"},
    "Washington DC": {"type": "literal", "value": "kWh"}
  },

  "Renewable Energy Usage": {
    "Boston": {"type": "column", "name": "Renewable System Electricity Usage Onsite (kBtu)"},
    "California": {"type": "column", "name": "Electricity Use – Generated from Onsite Renewable Systems and Used Onsite (kBtu)"},
    "Denver": {"type": "column", "name": "Electricity_Use_Onsite_Renewabl"},
    "Montgomery County": {"type": "column", "name": "Electricity Use Onsite Renewable (kWh)"},
    "New York City": {"type": "column", "name": "Electricity Use – Generated from Onsite Renewable Systems (kWh)"},
    "Washington DC": {"type": "column", "name": "ELECTRICITYUSE_RENEWABLE_KWH"}
  },

  "Renewable Energy Usage Units": {
    "Boston": {"type": "literal", "value": "kBtu"},
    "California": {"type": "literal", "value": "kBtu"},
    "Denver": {"type": "literal", "value": "kWh"},
    "Montgomery County": {"type": "literal", "value": "kWh"},
    "New York City": {"type": "literal", "value": "kWh"},
    "Washington DC": {"type": "literal", "value": "kWh"}
  },

  "Data Year": {
    "Boston": {"type": "literal", "value": "2021"},
    "California": {"type": "literal", "value": "2023"},
    "Chicago": {"type": "column", "name": "Data Year"},
    "Denver": {"type": "column", "name": "Reporting_Year"},
    "Montgomery County": {"type": "column", "name": "Reporting Year Start Date"},
    "New York City": {"type": "column", "name": "Calendar Year"},
    "Philadelphia": {"type": "column", "name": "data_year"},
    "Seattle": {"type": "column", "name": "DataYear"},
    "Washington DC": {"type": "column", "name": "REPORTINGYEAR"}
  }
}
