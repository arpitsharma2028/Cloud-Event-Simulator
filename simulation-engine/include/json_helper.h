#ifndef CLOUD_SIM_JSON_HELPER_H
#define CLOUD_SIM_JSON_HELPER_H

#include <string>
#include <vector>
#include <map>
#include <sstream>
#include <iomanip>
#include <cctype>
#include <cstdlib>

namespace cloudsim {
namespace json {

inline std::string escape(const std::string& s) {
    std::ostringstream o;
    for (char c : s) {
        if (c == '"') o << "\\\"";
        else if (c == '\\') o << "\\\\";
        else if (c == '\b') o << "\\b";
        else if (c == '\f') o << "\\f";
        else if (c == '\n') o << "\\n";
        else if (c == '\r') o << "\\r";
        else if (c == '\t') o << "\\t";
        else if (static_cast<unsigned char>(c) <= 0x1f) {
            o << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(c);
        } else {
            o << c;
        }
    }
    return o.str();
}

inline std::string quote(const std::string& s) {
    return "\"" + escape(s) + "\"";
}

// Simple key-value string extractor for flat/semi-flat JSON configs
inline std::string trim(const std::string& s) {
    size_t start = 0;
    while (start < s.size() && (std::isspace(s[start]) || s[start] == '"')) start++;
    size_t end = s.size();
    while (end > start && (std::isspace(s[end - 1]) || s[end - 1] == '"' || s[end - 1] == ',')) end--;
    return s.substr(start, end - start);
}

inline std::string findStringValue(const std::string& json, const std::string& key, const std::string& default_val = "") {
    std::string pattern = "\"" + key + "\"";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return default_val;

    pos = json.find(':', pos + pattern.size());
    if (pos == std::string::npos) return default_val;
    pos++;

    while (pos < json.size() && std::isspace(json[pos])) pos++;
    if (pos >= json.size()) return default_val;

    if (json[pos] == '"') {
        size_t end = json.find('"', pos + 1);
        if (end == std::string::npos) return default_val;
        return json.substr(pos + 1, end - (pos + 1));
    } else {
        size_t end = pos;
        while (end < json.size() && json[end] != ',' && json[end] != '}' && json[end] != ']' && !std::isspace(json[end])) {
            end++;
        }
        return json.substr(pos, end - pos);
    }
}

inline double findDoubleValue(const std::string& json, const std::string& key, double default_val = 0.0) {
    std::string s = findStringValue(json, key);
    if (s.empty()) return default_val;
    try {
        return std::stod(s);
    } catch (...) {
        return default_val;
    }
}

inline int findIntValue(const std::string& json, const std::string& key, int default_val = 0) {
    std::string s = findStringValue(json, key);
    if (s.empty()) return default_val;
    try {
        return std::stoi(s);
    } catch (...) {
        return default_val;
    }
}

inline bool findBoolValue(const std::string& json, const std::string& key, bool default_val = false) {
    std::string s = findStringValue(json, key);
    if (s.empty()) return default_val;
    return (s == "true" || s == "1");
}

// Extract JSON sub-block like "auto_scaler": { ... }
inline std::string extractObject(const std::string& json, const std::string& key) {
    std::string pattern = "\"" + key + "\"";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return "";

    pos = json.find('{', pos + pattern.size());
    if (pos == std::string::npos) return "";

    int depth = 1;
    size_t end = pos + 1;
    while (end < json.size() && depth > 0) {
        if (json[end] == '{') depth++;
        else if (json[end] == '}') depth--;
        end++;
    }
    return json.substr(pos, end - pos);
}

// Extract JSON array block like "failures": [ ... ]
inline std::string extractArray(const std::string& json, const std::string& key) {
    std::string pattern = "\"" + key + "\"";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return "";

    pos = json.find('[', pos + pattern.size());
    if (pos == std::string::npos) return "";

    int depth = 1;
    size_t end = pos + 1;
    while (end < json.size() && depth > 0) {
        if (json[end] == '[') depth++;
        else if (json[end] == ']') depth--;
        end++;
    }
    return json.substr(pos, end - pos);
}

// Split array into individual object strings
inline std::vector<std::string> splitArrayObjects(const std::string& array_str) {
    std::vector<std::string> objects;
    size_t i = 0;
    while (i < array_str.size()) {
        if (array_str[i] == '{') {
            int depth = 1;
            size_t start = i;
            i++;
            while (i < array_str.size() && depth > 0) {
                if (array_str[i] == '{') depth++;
                else if (array_str[i] == '}') depth--;
                i++;
            }
            objects.push_back(array_str.substr(start, i - start));
        } else {
            i++;
        }
    }
    return objects;
}

} // namespace json
} // namespace cloudsim

#endif // CLOUD_SIM_JSON_HELPER_H
