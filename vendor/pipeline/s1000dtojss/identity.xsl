<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D -> JSS: identification helpers

     DM code serialisation, data module titles, security classification and
     issue dates. The DM code string built here is the key used to match a
     dmRef against the data modules present in the source.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

    <!--
      Serialise a DM code to the canonical dotted form. Call with either a
      dmIdent or a dmRefIdent as the context node: both carry an optional
      identExtension followed by dmCode, so one template serves both and the
      two sides compare as strings.
    -->
    <xsl:template name="dmcode-string">
        <xsl:if test="identExtension">
            <xsl:value-of select="identExtension/@extensionProducer"/>
            <xsl:text>-</xsl:text>
            <xsl:value-of select="identExtension/@extensionCode"/>
            <xsl:text>-</xsl:text>
        </xsl:if>
        <xsl:for-each select="dmCode">
            <xsl:value-of select="@modelIdentCode"/>
            <xsl:text>-</xsl:text>
            <xsl:value-of select="@systemDiffCode"/>
            <xsl:text>-</xsl:text>
            <xsl:value-of select="@systemCode"/>
            <xsl:text>-</xsl:text>
            <xsl:value-of select="@subSystemCode"/>
            <xsl:value-of select="@subSubSystemCode"/>
            <xsl:text>-</xsl:text>
            <xsl:value-of select="@assyCode"/>
            <xsl:text>-</xsl:text>
            <xsl:value-of select="@disassyCode"/>
            <xsl:value-of select="@disassyCodeVariant"/>
            <xsl:text>-</xsl:text>
            <xsl:value-of select="@infoCode"/>
            <xsl:value-of select="@infoCodeVariant"/>
            <xsl:text>-</xsl:text>
            <xsl:value-of select="@itemLocationCode"/>
        </xsl:for-each>
    </xsl:template>

    <!-- Data module title: "techName - infoName". Context: a dmodule. -->
    <xsl:template name="dm-title">
        <xsl:variable name="t"
            select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle"/>
        <xsl:value-of select="normalize-space($t/techName)"/>
        <xsl:if test="$t/infoName != ''">
            <xsl:if test="$t/techName != ''"><xsl:text> - </xsl:text></xsl:if>
            <xsl:value-of select="normalize-space($t/infoName)"/>
        </xsl:if>
    </xsl:template>

    <!-- Publication module code, dotted. -->
    <xsl:template name="pm-code">
        <xsl:for-each select="$pm/identAndStatusSection/pmAddress/pmIdent/pmCode">
            <xsl:value-of select="@modelIdentCode"/>
            <xsl:text>-</xsl:text>
            <xsl:value-of select="@pmIssuer"/>
            <xsl:text>-</xsl:text>
            <xsl:value-of select="@pmNumber"/>
            <xsl:text>-</xsl:text>
            <xsl:value-of select="@pmVolume"/>
        </xsl:for-each>
    </xsl:template>

    <!--
      Security classification. S1000D encodes it as a numeric code on
      dmStatus/security/@securityClassification; JSS prints the word. An
      explicit stylesheet parameter always wins.
    -->
    <xsl:template name="security-label">
        <xsl:choose>
            <xsl:when test="$security.classification != ''">
                <xsl:call-template name="security-word">
                    <xsl:with-param name="code" select="$security.classification"/>
                </xsl:call-template>
            </xsl:when>
            <xsl:otherwise>
                <xsl:call-template name="security-word">
                    <xsl:with-param name="code"
                        select="$first.dm/identAndStatusSection/dmStatus/security/@securityClassification"/>
                </xsl:call-template>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template name="security-word">
        <xsl:param name="code"/>
        <xsl:choose>
            <xsl:when test="$code = '01'">UNCLASSIFIED</xsl:when>
            <xsl:when test="$code = '02'">RESTRICTED</xsl:when>
            <xsl:when test="$code = '03'">CONFIDENTIAL</xsl:when>
            <xsl:when test="$code = '04'">SECRET</xsl:when>
            <xsl:when test="$code = '05'">TOP SECRET</xsl:when>
            <xsl:when test="$code != ''">
                <!-- Already a word (e.g. "Demo", "Proprietary") -->
                <xsl:value-of select="translate($code, $lower, $upper)"/>
            </xsl:when>
            <xsl:otherwise>RESTRICTED</xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!-- Issue date -> month name + year, as printed on the title pages. -->
    <xsl:template name="issue-month-year">
        <xsl:variable name="d"
            select="($pm/identAndStatusSection/pmAddress/pmAddressItems/issueDate
                     | $first.dm/identAndStatusSection/dmAddress/dmAddressItems/issueDate)[1]"/>
        <month>
            <xsl:choose>
                <xsl:when test="$d/@month">
                    <xsl:call-template name="month-name">
                        <xsl:with-param name="m" select="number($d/@month)"/>
                    </xsl:call-template>
                </xsl:when>
                <xsl:otherwise>Month</xsl:otherwise>
            </xsl:choose>
        </month>
        <year>
            <xsl:choose>
                <xsl:when test="$d/@year"><xsl:value-of select="$d/@year"/></xsl:when>
                <xsl:otherwise>YYYY</xsl:otherwise>
            </xsl:choose>
        </year>
    </xsl:template>

    <xsl:template name="month-name">
        <xsl:param name="m"/>
        <xsl:choose>
            <xsl:when test="$m = 1">January</xsl:when>
            <xsl:when test="$m = 2">February</xsl:when>
            <xsl:when test="$m = 3">March</xsl:when>
            <xsl:when test="$m = 4">April</xsl:when>
            <xsl:when test="$m = 5">May</xsl:when>
            <xsl:when test="$m = 6">June</xsl:when>
            <xsl:when test="$m = 7">July</xsl:when>
            <xsl:when test="$m = 8">August</xsl:when>
            <xsl:when test="$m = 9">September</xsl:when>
            <xsl:when test="$m = 10">October</xsl:when>
            <xsl:when test="$m = 11">November</xsl:when>
            <xsl:when test="$m = 12">December</xsl:when>
            <xsl:otherwise>Month</xsl:otherwise>
        </xsl:choose>
    </xsl:template>

</xsl:stylesheet>
